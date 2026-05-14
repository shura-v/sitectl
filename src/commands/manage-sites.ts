import { note, outro } from "@clack/prompts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureDefaultDataFile, readDataText } from "../assets.js";
import { isPromptCancelledError, promptSelect, promptText } from "../cli.js";
import {
  createSiteDirectory,
  getSitesDirectoryPath,
  hasSiteConfig,
  listSiteNames,
  readSiteConfig
} from "../sites.js";
import { runForegroundCommand } from "./run-foreground-command.js";
import { resolveServer } from "./server-target.js";

export async function runManageSitesCommand(): Promise<void> {
  while (true) {
    let action: "add-site" | "copy-conf-files-to-server" | "back";

    try {
      action = await promptSelect(
        [
          {
            value: "add-site",
            label: "Add site",
            hint: "Create a site folder in the local nginx registry"
          },
          {
            value: "copy-conf-files-to-server",
            label: "Copy conf files to server",
            hint: "Upload bootstrap + https nginx configs to a server"
          },
          {
            value: "back",
            label: "Back",
            hint: "Return to the main menu"
          }
        ],
        "Manage sites"
      );
    } catch (error) {
      if (isPromptCancelledError(error)) {
        return;
      }

      throw error;
    }

    if (action === "back") {
      return;
    }

    try {
      if (action === "add-site") {
        await runAddSiteAction();
        continue;
      }

      await runCopyConfFilesToServerAction();
    } catch (error) {
      if (isPromptCancelledError(error)) {
        continue;
      }

      throw error;
    }
  }
}

async function runAddSiteAction(): Promise<void> {
  const siteName = await promptText({
    message: "Site name",
    placeholder: "example.com",
    validate: (value) => {
      if (value.length === 0) {
        return "Site name is required.";
      }

      if (value === "." || value === "..") {
        return "Site name must not be '.' or '..'.";
      }

      if (value.includes("/")) {
        return "Site name must not contain '/'.";
      }

      return undefined;
    }
  });
  const siteDirectoryPath = await createSiteDirectory(siteName);

  outro(`Site folder created: ${siteDirectoryPath}`);
}

async function runCopyConfFilesToServerAction(): Promise<void> {
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
