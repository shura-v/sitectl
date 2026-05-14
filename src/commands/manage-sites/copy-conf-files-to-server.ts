import { note, outro } from "@clack/prompts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDefaultDataFile, readDataText } from "../../assets.js";
import { promptSelect } from "../../cli.js";
import {
  getSitesDirectoryPath,
  hasSiteConfig,
  listSiteNames,
  readSiteConfig
} from "../../sites.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import { resolveServer } from "../utils/server-target.js";

export async function runCopyConfFilesToServerAction(): Promise<void> {
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
  await ensureDefaultDataFile("nginx/bootstrap.conf", "nginx/bootstrap.conf");
  const bootstrapTemplate = await readDataText("nginx/bootstrap.conf");
  const siteHasConfig = await hasSiteConfig(siteName);
  const httpsConfig = siteHasConfig ? await readSiteConfig(siteName) : null;
  const bootstrapConfig = bootstrapTemplate.replaceAll("__SITE_NAME__", siteName);
  const workingDirectory = await mkdtemp(join(tmpdir(), "sitectl-nginx-"));

  try {
    const bootstrapPath = join(workingDirectory, `${siteName}.bootstrap.conf`);
    await writeFile(bootstrapPath, bootstrapConfig, "utf8");
    const rsyncSourcePaths = [bootstrapPath];

    if (httpsConfig) {
      const httpsPath = join(workingDirectory, `${siteName}.conf`);
      await writeFile(httpsPath, httpsConfig, "utf8");
      rsyncSourcePaths.push(httpsPath);
    } else {
      note(
        `Missing ${join(getSitesDirectoryPath(), siteName, "nginx.conf")}. Copying only bootstrap config.`,
        "Missing config"
      );
    }

    const deployTarget = `${server.user}@${server.address}`;
    const rsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      server.user === "root" ? "rsync" : "sudo rsync",
      ...rsyncSourcePaths,
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

    await runForegroundCommand("rsync", rsyncArgs, { throwOnNonZero: true });
    await runForegroundCommand("ssh", reloadArgs, { throwOnNonZero: true });
    outro(
      httpsConfig
        ? `Nginx configs for "${siteName}" copied to "${serverName}".`
        : `Bootstrap config for "${siteName}" copied to "${serverName}".`
    );
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
