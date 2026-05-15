import { note, outro } from "@clack/prompts";
import { promptConfirm } from "../../cli.js";
import { detectHostKind, normalizeHostValue, type HostKind } from "../../hosts.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import { formatServerSshTarget } from "../utils/server-target.js";
import {
  REMOTE_PYTHON_CERTBOT_PATH,
  chooseSiteAndServer,
  enableRemoteSiteConfig,
  readRemoteSymlinkTarget,
  remoteFindCertificateLineage,
  resolveRemoteCertbotExecutable,
  runCommandCaptureStdout,
  syncBootstrapConfigToServer,
  restoreRemoteSiteConfig,
  shellQuote,
  syncSiteHttpsConfigToServer,
  updateLocalSiteConfigLineage
} from "./shared.js";

export async function runIssueCertificateAction(): Promise<void> {
  const { siteName, serverName, server } = await chooseSiteAndServer();
  const hostKind = detectHostKind(siteName);
  const targetFileName = `${siteName}.conf`;
  const previousTarget = await readRemoteSymlinkTarget(server, targetFileName);
  const bootstrapTarget = `/etc/nginx/sites-available/${siteName}.bootstrap.conf`;
  const existingLineage = await remoteFindCertificateLineage(server, siteName);

  if (existingLineage) {
    note(
      `Certbot already knows a certificate for "${siteName}" as "${existingLineage}".`,
      "Existing certificate"
    );

    const approved = await promptConfirm(
      `Run certificate issuance again for "${siteName}" on "${serverName}"?`
    );

    if (!approved) {
      await updateLocalSiteConfigLineage(siteName, existingLineage);
      await syncSiteHttpsConfigToServer(siteName, server, existingLineage);
      outro(`Certificate issuance skipped. HTTPS config for "${siteName}" synced to "${serverName}".`);
      return;
    }
  }

  const deployTarget = formatServerSshTarget(server);
  const remoteCommand = await buildRemoteCertificateCommand({
    hostKind,
    siteName,
    serverName,
    runAsRoot: server.user === "root",
    deployTarget,
    sshPort: server.port,
    server
  });

  await syncBootstrapConfigToServer(siteName, server, { reload: false });

  await enableRemoteSiteConfig({
    siteName,
    serverName,
    server,
    sourceFileName: `${siteName}.bootstrap.conf`,
    targetFileName,
    successLabel: "HTTP bootstrap config"
  });

  try {
    await runForegroundCommand(
      "ssh",
      ["-p", String(server.port), deployTarget, remoteCommand],
      { throwOnNonZero: true }
    );
  } catch (error) {
    await restoreRemoteSiteConfig(server, targetFileName, previousTarget);
    throw error;
  }

  if (previousTarget.length > 0 && previousTarget !== bootstrapTarget) {
    await restoreRemoteSiteConfig(server, targetFileName, previousTarget);
  }

  const lineage = await remoteFindCertificateLineage(server, siteName);

  if (!lineage) {
      throw new Error(`Could not determine the Certbot lineage for "${siteName}".`);
  }

  await updateLocalSiteConfigLineage(siteName, lineage);
  await syncSiteHttpsConfigToServer(siteName, server, lineage);

  outro(`Certificate issued for "${siteName}" on "${serverName}".`);
}

export function buildCertbotIssueCommand(options: {
  certbotExecutable?: string;
  hostKind: HostKind;
  siteName: string;
}): string {
  const normalizedSiteName = normalizeHostValue(options.siteName);
  const quotedSiteName = shellQuote(normalizedSiteName);
  const certbotExecutable =
    options.certbotExecutable && options.certbotExecutable !== "certbot"
      ? shellQuote(options.certbotExecutable)
      : "certbot";

  if (options.hostKind === "domain") {
    return `${certbotExecutable} certonly --nginx -d ${quotedSiteName}`;
  }

  return [
    `${certbotExecutable} certonly`,
    "--preferred-profile shortlived",
    "--webroot",
    `--webroot-path ${shellQuote("/var/www/letsencrypt")}`,
    `--deploy-hook ${shellQuote("systemctl reload nginx")}`,
    `--ip-address ${quotedSiteName}`
  ].join(" ");
}

export function buildRemotePythonCertbotInstallCommand(runAsRoot: boolean): string {
  const prefix = runAsRoot ? "" : "sudo ";
  const renewalJobPath = "/etc/cron.d/sitectl-certbot-renew";
  const renewalJob = [
    "SHELL=/bin/sh",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    `0 0,12 * * * root ${REMOTE_PYTHON_CERTBOT_PATH} renew -q`
  ].join("\\n");

  return [
    `${prefix}apt update`,
    `${prefix}apt install -y python3 python3-venv libaugeas-dev gcc`,
    `${prefix}mkdir -p /opt`,
    `${prefix}python3 -m venv /opt/certbot`,
    `${prefix}/opt/certbot/bin/pip install --upgrade pip`,
    `${prefix}/opt/certbot/bin/pip install --upgrade certbot certbot-nginx`,
    `${prefix}sh -c ${shellQuote(`printf '%b\\n' '${renewalJob}' > ${renewalJobPath}`)}`
  ].join(" && ");
}

function wrapRemoteCommandForPrivileges(command: string, runAsRoot: boolean): string {
  return runAsRoot ? command : `sudo ${command}`;
}

export function parseCertbotVersion(output: string): string | null {
  const match = output.match(/certbot\s+(\d+(?:\.\d+){0,2})/i);
  return match?.[1] ?? null;
}

export function isCertbotVersionAtLeast(version: string, minimum: string): boolean {
  const versionParts = version.split(".").map((part) => Number(part));
  const minimumParts = minimum.split(".").map((part) => Number(part));
  const maxLength = Math.max(versionParts.length, minimumParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const current = versionParts[index] ?? 0;
    const required = minimumParts[index] ?? 0;

    if (current > required) {
      return true;
    }

    if (current < required) {
      return false;
    }
  }

  return true;
}

type IssueCertbotMode = "domain" | "ip";

async function buildRemoteCertificateCommand(options: {
  hostKind: HostKind;
  siteName: string;
  serverName: string;
  runAsRoot: boolean;
  deployTarget: string;
  sshPort: number;
  server: Awaited<ReturnType<typeof chooseSiteAndServer>>["server"];
}): Promise<string> {
  const mode: IssueCertbotMode = options.hostKind === "domain" ? "domain" : "ip";
  let certbotExecutable = await resolveCertbotForIssue({
    mode,
    deployTarget: options.deployTarget,
    runAsRoot: options.runAsRoot,
    server: options.server,
    sshPort: options.sshPort
  });

  if (!certbotExecutable && mode === "ip") {
    const approved = await promptConfirm(
      `IP certificate issuance for "${options.siteName}" on "${options.serverName}" needs certbot 5.4.0+. Install an isolated newer certbot in /opt/certbot and configure automatic renewal?`
    );

    if (!approved) {
      throw new Error(
        `IP certificate issuance requires certbot 5.4.0 or newer on "${options.serverName}".`
      );
    }

    note(
      `Installing an isolated certbot in ${REMOTE_PYTHON_CERTBOT_PATH} on "${options.serverName}".`,
      "Install certbot"
    );
    const installCommand = buildRemotePythonCertbotInstallCommand(options.runAsRoot);
    await runForegroundCommand(
      "ssh",
      ["-p", String(options.sshPort), options.deployTarget, installCommand],
      { throwOnNonZero: true }
    );

    certbotExecutable = await resolveCertbotForIssue({
      mode,
      deployTarget: options.deployTarget,
      runAsRoot: options.runAsRoot,
      server: options.server,
      sshPort: options.sshPort
    });

    if (!certbotExecutable) {
      throw new Error(
        `The isolated certbot install on "${options.serverName}" did not provide certbot 5.4.0 or newer.`
      );
    }
  }

  if (!certbotExecutable) {
    throw new Error(`Could not find a usable certbot on "${options.serverName}".`);
  }

  const webrootPath = shellQuote("/var/www/letsencrypt");
  const mkdirCommand = options.runAsRoot ? `mkdir -p ${webrootPath}` : `sudo mkdir -p ${webrootPath}`;
  const command = buildCertbotIssueCommand({
    certbotExecutable,
    hostKind: options.hostKind,
    siteName: options.siteName
  });

  return `${mkdirCommand} && ${wrapRemoteCommandForPrivileges(command, options.runAsRoot)}`;
}

async function resolveCertbotForIssue(options: {
  mode: IssueCertbotMode;
  deployTarget: string;
  runAsRoot: boolean;
  server: Awaited<ReturnType<typeof chooseSiteAndServer>>["server"];
  sshPort: number;
}): Promise<string | null> {
  if (options.mode === "domain") {
    const systemVersion = await readRemoteCertbotVersion(
      options.deployTarget,
      options.sshPort,
      options.runAsRoot,
      "certbot"
    );

    if (systemVersion) {
      return "certbot";
    }

    try {
      return await resolveRemoteCertbotExecutable(options.server);
    } catch {
      return null;
    }
  }

  const systemVersion = await readRemoteCertbotVersion(
    options.deployTarget,
    options.sshPort,
    options.runAsRoot,
    "certbot"
  );

  if (systemVersion && isCertbotVersionAtLeast(systemVersion, "5.4.0")) {
    return "certbot";
  }

  const existingPythonCertbotVersion = await readRemoteCertbotVersion(
    options.deployTarget,
    options.sshPort,
    options.runAsRoot,
    REMOTE_PYTHON_CERTBOT_PATH
  );

  if (existingPythonCertbotVersion && isCertbotVersionAtLeast(existingPythonCertbotVersion, "5.4.0")) {
    return REMOTE_PYTHON_CERTBOT_PATH;
  }

  return null;
}

async function readRemoteCertbotVersion(
  deployTarget: string,
  sshPort: number,
  runAsRoot: boolean,
  certbotExecutable = "certbot"
): Promise<string | null> {
  const versionCommand = runAsRoot
    ? `${shellQuote(certbotExecutable)} --version`
    : `sudo ${shellQuote(certbotExecutable)} --version`;

  try {
    const output = await runCommandCaptureStdout("ssh", [
      "-p",
      String(sshPort),
      deployTarget,
      versionCommand
    ]);

    return parseCertbotVersion(output);
  } catch {
    return null;
  }
}
