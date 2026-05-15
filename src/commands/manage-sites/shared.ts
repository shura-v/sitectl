import { outro } from "@clack/prompts";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDataPath, readBundledConfigText } from "../../assets.js";
import { promptSelect } from "../../cli.js";
import { normalizeHostValue } from "../../hosts.js";
import {
  getSitesDirectoryPath,
  listSites,
  readBundledBootstrapTemplate,
  readBundledSslManagedTemplate,
  readSiteConfig,
  renderSslManagedTemplate,
  renderSiteTemplate,
  seedSiteConfig
} from "../../sites.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import {
  formatServerRsyncDestination,
  formatServerSshTarget,
  resolveServer
} from "../utils/server-target.js";

export type ResolvedSiteServer = {
  siteName: string;
  serverName: string;
  server: Awaited<ReturnType<typeof resolveServer>>["server"];
};

export type RemoteCertificateLineage = {
  certificateName: string;
  domains: string[];
};

export const REMOTE_PYTHON_CERTBOT_PATH = "/opt/certbot/bin/certbot";
const REMOTE_NGINX_INCLUDE_DIRECTORY = "/etc/nginx/sitectl-includes";

export async function chooseSiteAndServer(): Promise<ResolvedSiteServer> {
  const sites = await listSites();

  if (sites.length === 0) {
    throw new Error(`No site folders found in ${getSitesDirectoryPath()}.`);
  }

  const siteName = await promptSelect(
    sites.map((site) => ({
      value: site.name,
      label: formatSiteLabel(site.name, site.note)
    })),
    "Choose a site"
  );
  const { name: serverName, server } = await resolveServer();

  return {
    siteName,
    serverName,
    server
  };
}

export function formatSiteLabel(siteName: string, note: string | null): string {
  return note ? `${siteName} (${note})` : siteName;
}

export async function enableRemoteSiteConfig(options: {
  siteName: string;
  serverName: string;
  server: ResolvedSiteServer["server"];
  sourceFileName: string;
  targetFileName: string;
  successLabel: string;
}): Promise<void> {
  const deployTarget = formatServerSshTarget(options.server);
  const sourcePath = `/etc/nginx/sites-available/${options.sourceFileName}`;
  const targetPath = `/etc/nginx/sites-enabled/${options.targetFileName}`;
  const quotedSourcePath = shellQuote(sourcePath);
  const quotedTargetPath = shellQuote(targetPath);
  const restoreCommand = [
    'if [ -n "$previous_target" ]; then',
    `  ln -sfn "$previous_target" ${quotedTargetPath};`,
    "else",
    `  rm -f ${quotedTargetPath};`,
    "fi"
  ].join(" ");
  const applyCommand =
    options.server.user === "root"
      ? `if nginx -t && systemctl reload nginx; then true; else ${restoreCommand} && exit 1; fi`
      : `if sudo nginx -t && sudo systemctl reload nginx; then true; else ${restoreCommand
          .replaceAll("ln -sfn", "sudo ln -sfn")
          .replaceAll("rm -f", "sudo rm -f")} && exit 1; fi`;
  const remoteCommand =
    options.server.user === "root"
      ? [
          `test -f ${quotedSourcePath}`,
          `previous_target=$(readlink ${quotedTargetPath} 2>/dev/null || true)`,
          `ln -sfn ${quotedSourcePath} ${quotedTargetPath}`,
          applyCommand
        ].join(" && ")
      : [
          `sudo test -f ${quotedSourcePath}`,
          `previous_target=$(sudo readlink ${quotedTargetPath} 2>/dev/null || true)`,
          `sudo ln -sfn ${quotedSourcePath} ${quotedTargetPath}`,
          applyCommand
        ].join(" && ");

  await runForegroundCommand(
    "ssh",
    ["-p", String(options.server.port), deployTarget, remoteCommand],
    { throwOnNonZero: true }
  );
  outro(`${options.successLabel} for "${options.siteName}" enabled on "${options.serverName}".`);
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export async function readRemoteSymlinkTarget(
  server: ResolvedSiteServer["server"],
  targetFileName: string
): Promise<string> {
  const deployTarget = formatServerSshTarget(server);
  const targetPath = `/etc/nginx/sites-enabled/${targetFileName}`;
  const readCommand =
    server.user === "root"
      ? `readlink ${shellQuote(targetPath)} 2>/dev/null || true`
      : `sudo readlink ${shellQuote(targetPath)} 2>/dev/null || true`;

  return runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    deployTarget,
    readCommand
  ]);
}

export async function restoreRemoteSiteConfig(
  server: ResolvedSiteServer["server"],
  targetFileName: string,
  previousTarget: string
): Promise<void> {
  const deployTarget = formatServerSshTarget(server);
  const targetPath = `/etc/nginx/sites-enabled/${targetFileName}`;
  const quotedTargetPath = shellQuote(targetPath);
  const restoreCommand =
    previousTarget.length > 0
      ? `ln -sfn ${shellQuote(previousTarget)} ${quotedTargetPath}`
      : `rm -f ${quotedTargetPath}`;
  const remoteCommand =
    server.user === "root"
      ? `${restoreCommand} && nginx -t && systemctl reload nginx`
      : `sudo ${restoreCommand} && sudo nginx -t && sudo systemctl reload nginx`;

  await runForegroundCommand(
    "ssh",
    ["-p", String(server.port), deployTarget, remoteCommand],
    { throwOnNonZero: true }
  );
}

export async function remoteFindCertificateLineage(
  server: ResolvedSiteServer["server"],
  siteName: string
): Promise<string | null> {
  const lineage = await remoteFindCertificateLineageDetails(server, siteName);
  return lineage?.certificateName ?? null;
}

export async function remoteSslManagedIncludeExists(
  server: ResolvedSiteServer["server"],
  siteName: string
): Promise<boolean> {
  return remoteFileExists(server, `${REMOTE_NGINX_INCLUDE_DIRECTORY}/${siteName}.ssl.conf`);
}

export async function remoteFindCertificateLineageDetails(
  server: ResolvedSiteServer["server"],
  siteName: string
): Promise<RemoteCertificateLineage | null> {
  const deployTarget = formatServerSshTarget(server);
  const certbotExecutable = await resolveRemoteCertbotExecutable(server);

  if (!certbotExecutable) {
    return null;
  }

  const certificatesCommand =
    server.user === "root"
      ? `${shellQuote(certbotExecutable)} certificates 2>/dev/null || true`
      : `sudo ${shellQuote(certbotExecutable)} certificates 2>/dev/null || true`;
  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    deployTarget,
    certificatesCommand
  ]);

  return parseCertbotLineage(output, siteName);
}

export async function resolveRemoteCertbotExecutable(
  server: ResolvedSiteServer["server"]
): Promise<string | null> {
  const deployTarget = formatServerSshTarget(server);
  const discoveryCommand = [
    `if [ -x ${shellQuote(REMOTE_PYTHON_CERTBOT_PATH)} ]; then`,
    `  echo ${shellQuote(REMOTE_PYTHON_CERTBOT_PATH)};`,
    "elif command -v certbot >/dev/null 2>&1; then",
    "  echo certbot;",
    "else",
    "  echo none;",
    "fi"
  ].join(" ");
  const command = server.user === "root" ? discoveryCommand : `sudo sh -c ${shellQuote(discoveryCommand)}`;

  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    deployTarget,
    command
  ]);

  return output === "none" ? null : output;
}

export function parseCertbotLineage(
  output: string,
  siteName: string
): RemoteCertificateLineage | null {
  const normalizedSiteName = normalizeHostValue(siteName);
  const blocks = output.split(/(?:^|\n)\s*Certificate Name:\s*/).slice(1);

  for (const block of blocks) {
    const lines = block.split("\n");
    const certificateName = lines[0]?.trim();
    const identifiersLine = lines.find((line) => {
      const trimmedLine = line.trim();
      return trimmedLine.startsWith("Domains:") || trimmedLine.startsWith("Identifiers:");
    });

    if (!certificateName || !identifiersLine) {
      continue;
    }

    const domains = identifiersLine
      .trim()
      .replace(/^(Domains|Identifiers):\s*/, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((identifier) =>
        identifier.startsWith("IP:") ? identifier.slice(3) : identifier
      )
      .map((identifier) => normalizeHostValue(identifier));

    if (domains.includes(normalizedSiteName)) {
      return {
        certificateName,
        domains
      };
    }
  }

  return null;
}

export async function updateLocalSiteConfigLineage(
  siteName: string,
  lineage: string
): Promise<void> {
  await rewriteLocalSiteConfigCertificatePaths(siteName, lineage);
}

export async function resetLocalSiteConfigCertificatePaths(
  siteName: string
): Promise<void> {
  await rewriteLocalSiteConfigCertificatePaths(siteName, siteName);
}

async function rewriteLocalSiteConfigCertificatePaths(
  siteName: string,
  lineage: string
): Promise<void> {
  const siteConfigPath = getDataPath(`nginx/sites/${siteName}/nginx.conf`);
  await seedSiteConfig(siteName);
  const currentConfig = await readSiteConfig(siteName);
  const nextConfig = currentConfig
    .replace(
      /ssl_certificate\s+\/etc\/letsencrypt\/live\/[^/]+\/fullchain\.pem;/,
      `ssl_certificate     /etc/letsencrypt/live/${lineage}/fullchain.pem;`
    )
    .replace(
      /ssl_certificate_key\s+\/etc\/letsencrypt\/live\/[^/]+\/privkey\.pem;/,
      `ssl_certificate_key /etc/letsencrypt/live/${lineage}/privkey.pem;`
    );

  if (nextConfig !== currentConfig) {
    await writeFile(siteConfigPath, nextConfig, "utf8");
  }
}

export async function syncSiteHttpsConfigToServer(
  siteName: string,
  server: ResolvedSiteServer["server"],
  lineage = siteName
): Promise<void> {
  const httpsConfig = await readSiteConfig(siteName);
  const acmeInclude = await readBundledConfigText("nginx/acme-challenge.conf");
  const sslManagedTemplate = await readBundledSslManagedTemplate();
  const sslManagedConfig = renderSslManagedTemplate(sslManagedTemplate, lineage);
  const workingDirectory = await mkdtemp(join(tmpdir(), "sitectl-nginx-https-"));
  const deployTarget = formatServerSshTarget(server);
  const remoteArtifacts = await readRemoteHttpsArtifacts(server, siteName);

  try {
    const localFiles = await prepareLocalHttpsSyncFiles({
      workingDirectory,
      siteName,
      httpsConfig,
      acmeInclude,
      sslManagedConfig
    });

    await backupRemoteHttpsArtifacts(server, deployTarget, remoteArtifacts);

    try {
      await uploadRemoteHttpsArtifacts(server, localFiles);
      await reloadRemoteNginx(server, deployTarget);
    } catch (error) {
      await restoreRemoteHttpsArtifacts(server, deployTarget, remoteArtifacts);
      throw error;
    }
  } finally {
    await cleanupRemoteHttpsArtifactBackups(server, deployTarget, remoteArtifacts);
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

type RemoteHttpsArtifact = {
  targetPath: string;
  backupPath: string;
  existed: boolean;
};

type RemoteHttpsArtifacts = {
  siteConfig: RemoteHttpsArtifact;
  sslInclude: RemoteHttpsArtifact;
};

type LocalHttpsSyncFiles = {
  httpsPath: string;
  acmeIncludePath: string;
  sslManagedPath: string;
};

async function readRemoteHttpsArtifacts(
  server: ResolvedSiteServer["server"],
  siteName: string
): Promise<RemoteHttpsArtifacts> {
  const siteConfigTargetPath = `/etc/nginx/sites-available/${siteName}.conf`;
  const sslIncludeTargetPath = `${REMOTE_NGINX_INCLUDE_DIRECTORY}/${siteName}.ssl.conf`;

  return {
    siteConfig: {
      targetPath: siteConfigTargetPath,
      backupPath: `/tmp/sitectl-${siteName}.conf.backup`,
      existed: await remoteFileExists(server, siteConfigTargetPath)
    },
    sslInclude: {
      targetPath: sslIncludeTargetPath,
      backupPath: `/tmp/sitectl-${siteName}.ssl.conf.backup`,
      existed: await remoteFileExists(server, sslIncludeTargetPath)
    }
  };
}

async function prepareLocalHttpsSyncFiles(options: {
  workingDirectory: string;
  siteName: string;
  httpsConfig: string;
  acmeInclude: string;
  sslManagedConfig: string;
}): Promise<LocalHttpsSyncFiles> {
  const httpsPath = join(options.workingDirectory, `${options.siteName}.conf`);
  const acmeIncludePath = join(options.workingDirectory, "acme-challenge.conf");
  const sslManagedPath = join(options.workingDirectory, `${options.siteName}.ssl.conf`);

  await writeFile(httpsPath, options.httpsConfig, "utf8");
  await writeFile(acmeIncludePath, options.acmeInclude, "utf8");
  await writeFile(sslManagedPath, options.sslManagedConfig, "utf8");

  return {
    httpsPath,
    acmeIncludePath,
    sslManagedPath
  };
}

async function backupRemoteHttpsArtifacts(
  server: ResolvedSiteServer["server"],
  deployTarget: string,
  artifacts: RemoteHttpsArtifacts
): Promise<void> {
  await backupRemoteArtifact(server, deployTarget, artifacts.siteConfig);
  await backupRemoteArtifact(server, deployTarget, artifacts.sslInclude);
}

async function backupRemoteArtifact(
  server: ResolvedSiteServer["server"],
  deployTarget: string,
  artifact: RemoteHttpsArtifact
): Promise<void> {
  if (!artifact.existed) {
    return;
  }

  const quotedTargetPath = shellQuote(artifact.targetPath);
  const quotedBackupPath = shellQuote(artifact.backupPath);
  const backupCommand =
    server.user === "root"
      ? `cp ${quotedTargetPath} ${quotedBackupPath}`
      : `sudo cp ${quotedTargetPath} ${quotedBackupPath}`;

  await runForegroundCommand(
    "ssh",
    ["-p", String(server.port), deployTarget, backupCommand],
    { throwOnNonZero: true }
  );
}

async function uploadRemoteHttpsArtifacts(
  server: ResolvedSiteServer["server"],
  localFiles: LocalHttpsSyncFiles
): Promise<void> {
  const rsyncArgs = [
    "-avz",
    "-e",
    `ssh -p ${server.port}`,
    "--chown=root:root",
    "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
    "--rsync-path",
    server.user === "root" ? "rsync" : "sudo rsync",
    localFiles.httpsPath,
    formatServerRsyncDestination(server, "/etc/nginx/sites-available/")
  ];
  const includeRsyncArgs = [
    "-avz",
    "-e",
    `ssh -p ${server.port}`,
    "--chown=root:root",
    "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
    "--rsync-path",
    server.user === "root"
      ? `mkdir -p ${shellQuote(REMOTE_NGINX_INCLUDE_DIRECTORY)} && rsync`
      : `sudo mkdir -p ${shellQuote(REMOTE_NGINX_INCLUDE_DIRECTORY)} && sudo rsync`,
    localFiles.acmeIncludePath,
    localFiles.sslManagedPath,
    formatServerRsyncDestination(server, `${REMOTE_NGINX_INCLUDE_DIRECTORY}/`)
  ];

  await runForegroundCommand("rsync", includeRsyncArgs, { throwOnNonZero: true });
  await runForegroundCommand("rsync", rsyncArgs, { throwOnNonZero: true });
}

async function reloadRemoteNginx(
  server: ResolvedSiteServer["server"],
  deployTarget: string
): Promise<void> {
  const reloadArgs = [
    "-p",
    String(server.port),
    deployTarget,
    server.user === "root"
      ? "nginx -t && systemctl reload nginx"
      : "sudo nginx -t && sudo systemctl reload nginx"
  ];

  await runForegroundCommand("ssh", reloadArgs, { throwOnNonZero: true });
}

async function restoreRemoteHttpsArtifacts(
  server: ResolvedSiteServer["server"],
  deployTarget: string,
  artifacts: RemoteHttpsArtifacts
): Promise<void> {
  const restoreCommands =
    server.user === "root"
      ? [
          buildRestoreRemoteArtifactCommand(artifacts.siteConfig),
          buildRestoreRemoteArtifactCommand(artifacts.sslInclude),
          "nginx -t",
          "systemctl reload nginx"
        ]
      : [
          prefixCommandWithSudo(buildRestoreRemoteArtifactCommand(artifacts.siteConfig)),
          prefixCommandWithSudo(buildRestoreRemoteArtifactCommand(artifacts.sslInclude)),
          "sudo nginx -t",
          "sudo systemctl reload nginx"
        ];

  await runForegroundCommand(
    "ssh",
    ["-p", String(server.port), deployTarget, restoreCommands.join(" && ")],
    { throwOnNonZero: true }
  );
}

function buildRestoreRemoteArtifactCommand(artifact: RemoteHttpsArtifact): string {
  return artifact.existed
    ? `cp ${shellQuote(artifact.backupPath)} ${shellQuote(artifact.targetPath)}`
    : `rm -f ${shellQuote(artifact.targetPath)}`;
}

async function cleanupRemoteHttpsArtifactBackups(
  server: ResolvedSiteServer["server"],
  deployTarget: string,
  artifacts: RemoteHttpsArtifacts
): Promise<void> {
  await cleanupRemoteArtifactBackup(server, deployTarget, artifacts.siteConfig);
  await cleanupRemoteArtifactBackup(server, deployTarget, artifacts.sslInclude);
}

async function cleanupRemoteArtifactBackup(
  server: ResolvedSiteServer["server"],
  deployTarget: string,
  artifact: RemoteHttpsArtifact
): Promise<void> {
  if (!artifact.existed) {
    return;
  }

  const cleanupCommand =
    server.user === "root"
      ? `rm -f ${shellQuote(artifact.backupPath)}`
      : `sudo rm -f ${shellQuote(artifact.backupPath)}`;

  try {
    await runForegroundCommand(
      "ssh",
      ["-p", String(server.port), deployTarget, cleanupCommand],
      { throwOnNonZero: true }
    );
  } catch {
    // Keep the original operation result; a stale temp backup is tolerable.
  }
}

function prefixCommandWithSudo(command: string): string {
  return command
    .replace(/^cp\b/, "sudo cp")
    .replace(/^rm -f\b/, "sudo rm -f");
}

export async function syncBootstrapConfigToServer(
  siteName: string,
  server: ResolvedSiteServer["server"],
  options: {
    reload?: boolean;
  } = {}
): Promise<void> {
  const bootstrapTemplate = await readBundledBootstrapTemplate();
  const acmeInclude = await readBundledConfigText("nginx/acme-challenge.conf");
  const bootstrapConfig = renderSiteTemplate(bootstrapTemplate, siteName);
  const workingDirectory = await mkdtemp(join(tmpdir(), "sitectl-nginx-bootstrap-"));
  const deployTarget = formatServerSshTarget(server);
  const shouldReload = options.reload ?? true;

  try {
    const bootstrapPath = join(workingDirectory, `${siteName}.bootstrap.conf`);
    const acmeIncludePath = join(workingDirectory, "acme-challenge.conf");
    await writeFile(bootstrapPath, bootstrapConfig, "utf8");
    await writeFile(acmeIncludePath, acmeInclude, "utf8");

    const rsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      server.user === "root" ? "rsync" : "sudo rsync",
      bootstrapPath,
      formatServerRsyncDestination(server, "/etc/nginx/sites-available/")
    ];
    const includeRsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      server.user === "root"
        ? `mkdir -p ${shellQuote(REMOTE_NGINX_INCLUDE_DIRECTORY)} && rsync`
        : `sudo mkdir -p ${shellQuote(REMOTE_NGINX_INCLUDE_DIRECTORY)} && sudo rsync`,
      acmeIncludePath,
      formatServerRsyncDestination(server, `${REMOTE_NGINX_INCLUDE_DIRECTORY}/`)
    ];
    await runForegroundCommand("rsync", includeRsyncArgs, { throwOnNonZero: true });
    await runForegroundCommand("rsync", rsyncArgs, { throwOnNonZero: true });

    if (shouldReload) {
      const reloadArgs = [
        "-p",
        String(server.port),
        deployTarget,
        server.user === "root"
          ? "nginx -t && systemctl reload nginx"
          : "sudo nginx -t && sudo systemctl reload nginx"
      ];

      await runForegroundCommand("ssh", reloadArgs, { throwOnNonZero: true });
    }
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

async function remoteFileExists(
  server: ResolvedSiteServer["server"],
  path: string
): Promise<boolean> {
  const deployTarget = formatServerSshTarget(server);
  const quotedPath = shellQuote(path);
  const checkCommand =
    server.user === "root"
      ? `if test -f ${quotedPath}; then echo yes; else echo no; fi`
      : `if sudo test -f ${quotedPath}; then echo yes; else echo no; fi`;
  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    deployTarget,
    checkCommand
  ]);

  return output.trim() === "yes";
}

export async function runCommandCaptureStdout(
  command: string,
  args: string[]
): Promise<string> {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "inherit"]
  });

  const stdoutChunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => {
        resolve({ code, signal });
      });
    }
  );

  if (result.signal) {
    throw new Error(`${command} was terminated by signal ${result.signal}.`);
  }

  if (result.code && result.code !== 0) {
    throw new Error(`${command} failed with exit code ${result.code}.`);
  }

  return Buffer.concat(stdoutChunks).toString("utf8").trim();
}
