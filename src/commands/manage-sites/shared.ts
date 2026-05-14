import { outro } from "@clack/prompts";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDataPath } from "../../assets.js";
import { promptSelect } from "../../cli.js";
import {
  getSitesDirectoryPath,
  listSiteNames,
  readSiteConfig,
  seedSiteConfig
} from "../../sites.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import { resolveServer } from "../utils/server-target.js";

export type ResolvedSiteServer = {
  siteName: string;
  serverName: string;
  server: Awaited<ReturnType<typeof resolveServer>>["server"];
};

export type RemoteCertificateLineage = {
  certificateName: string;
  domains: string[];
};

export async function chooseSiteAndServer(): Promise<ResolvedSiteServer> {
  const siteNames = await listSiteNames();

  if (siteNames.length === 0) {
    throw new Error(`No site folders found in ${getSitesDirectoryPath()}.`);
  }

  const siteName = await promptSelect(
    siteNames.map((name) => ({
      value: name,
      label: name
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

export async function enableRemoteSiteConfig(options: {
  siteName: string;
  serverName: string;
  server: ResolvedSiteServer["server"];
  sourceFileName: string;
  targetFileName: string;
  successLabel: string;
}): Promise<void> {
  const deployTarget = `${options.server.user}@${options.server.address}`;
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
  const deployTarget = `${server.user}@${server.address}`;
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
  const deployTarget = `${server.user}@${server.address}`;
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

export async function remoteFindCertificateLineageDetails(
  server: ResolvedSiteServer["server"],
  siteName: string
): Promise<RemoteCertificateLineage | null> {
  const deployTarget = `${server.user}@${server.address}`;
  const certificatesCommand =
    server.user === "root"
      ? "certbot certificates 2>/dev/null || true"
      : "sudo certbot certificates 2>/dev/null || true";
  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    deployTarget,
    certificatesCommand
  ]);

  return parseCertbotLineage(output, siteName);
}

export function parseCertbotLineage(
  output: string,
  siteName: string
): RemoteCertificateLineage | null {
  const blocks = output.split(/\n\s*Certificate Name:\s*/).slice(1);

  for (const block of blocks) {
    const lines = block.split("\n");
    const certificateName = lines[0]?.trim();
    const domainsLine = lines.find((line) => line.trim().startsWith("Domains:"));

    if (!certificateName || !domainsLine) {
      continue;
    }

    const domains = domainsLine
      .trim()
      .replace(/^Domains:\s*/, "")
      .split(/\s+/)
      .filter(Boolean);

    if (domains.includes(siteName)) {
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
  server: ResolvedSiteServer["server"]
): Promise<void> {
  const httpsConfig = await readSiteConfig(siteName);
  const workingDirectory = await mkdtemp(join(tmpdir(), "sitectl-nginx-https-"));
  const targetPath = `/etc/nginx/sites-available/${siteName}.conf`;
  const backupPath = `/tmp/sitectl-${siteName}.conf.backup`;
  const deployTarget = `${server.user}@${server.address}`;
  const quotedTargetPath = shellQuote(targetPath);
  const quotedBackupPath = shellQuote(backupPath);
  const hadExistingConfig = await remoteFileExists(server, targetPath);

  try {
    const httpsPath = join(workingDirectory, `${siteName}.conf`);
    await writeFile(httpsPath, httpsConfig, "utf8");

    if (hadExistingConfig) {
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

    const rsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      server.user === "root" ? "rsync" : "sudo rsync",
      httpsPath,
      `${deployTarget}:/etc/nginx/sites-available/`
    ];
    const reloadArgs = [
      "-p",
      String(server.port),
      deployTarget,
      server.user === "root"
        ? "nginx -t && systemctl reload nginx"
        : "sudo nginx -t && sudo systemctl reload nginx"
    ];

    try {
      await runForegroundCommand("rsync", rsyncArgs, { throwOnNonZero: true });
      await runForegroundCommand("ssh", reloadArgs, { throwOnNonZero: true });
    } catch (error) {
      const restoreCommand = hadExistingConfig
        ? server.user === "root"
          ? `cp ${quotedBackupPath} ${quotedTargetPath} && nginx -t && systemctl reload nginx`
          : `sudo cp ${quotedBackupPath} ${quotedTargetPath} && sudo nginx -t && sudo systemctl reload nginx`
        : server.user === "root"
          ? `rm -f ${quotedTargetPath} && nginx -t && systemctl reload nginx`
          : `sudo rm -f ${quotedTargetPath} && sudo nginx -t && sudo systemctl reload nginx`;

      await runForegroundCommand(
        "ssh",
        ["-p", String(server.port), deployTarget, restoreCommand],
        { throwOnNonZero: true }
      );
      throw error;
    }
  } finally {
    if (hadExistingConfig) {
      const cleanupCommand =
        server.user === "root"
          ? `rm -f ${quotedBackupPath}`
          : `sudo rm -f ${quotedBackupPath}`;

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

    await rm(workingDirectory, { recursive: true, force: true });
  }
}

async function remoteFileExists(
  server: ResolvedSiteServer["server"],
  path: string
): Promise<boolean> {
  const deployTarget = `${server.user}@${server.address}`;
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
