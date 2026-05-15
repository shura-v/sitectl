import { note, outro } from "@clack/prompts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBundledConfigText } from "../../assets.js";
import { promptSelect } from "../../cli.js";
import {
  getSitesDirectoryPath,
  hasSiteConfig,
  listSites,
  readBundledBootstrapTemplate,
  readBundledSslManagedTemplate,
  readSiteConfig,
  renderSslManagedTemplate,
  renderSiteTemplate
} from "../../sites.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import {
  formatServerRsyncDestination,
  formatServerSshTarget,
  resolveServer
} from "../utils/server-target.js";
import {
  formatSiteLabel,
  remoteFindCertificateLineage,
  remoteSslManagedIncludeExists
} from "./shared.js";

export async function runCopyConfFilesToServerAction(): Promise<void> {
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
  const acmeInclude = await readBundledConfigText("nginx/acme-challenge.conf");
  const sslManagedTemplate = await readBundledSslManagedTemplate();
  const bootstrapTemplate = await readBundledBootstrapTemplate();
  const siteHasConfig = await hasSiteConfig(siteName);
  const httpsConfig = siteHasConfig ? await readSiteConfig(siteName) : null;
  const bootstrapConfig = renderSiteTemplate(bootstrapTemplate, siteName);
  const existingLineage = httpsConfig ? await remoteFindCertificateLineage(server, siteName) : null;
  const hasRemoteSslManagedInclude = httpsConfig
    ? await remoteSslManagedIncludeExists(server, siteName)
    : false;
  const shouldUpdateSslManagedInclude =
    Boolean(existingLineage) || !hasRemoteSslManagedInclude;
  const sslManagedLineage = existingLineage ?? siteName;
  const sslManagedConfig = renderSslManagedTemplate(sslManagedTemplate, sslManagedLineage);
  const workingDirectory = await mkdtemp(join(tmpdir(), "sitectl-nginx-"));

  try {
    const bootstrapPath = join(workingDirectory, `${siteName}.bootstrap.conf`);
    const acmeIncludePath = join(workingDirectory, "acme-challenge.conf");
    await writeFile(bootstrapPath, bootstrapConfig, "utf8");
    await writeFile(acmeIncludePath, acmeInclude, "utf8");
    const rsyncSourcePaths = [bootstrapPath];
    const includeSourcePaths = [acmeIncludePath];

    if (shouldUpdateSslManagedInclude) {
      const sslManagedPath = join(workingDirectory, `${siteName}.ssl.conf`);
      await writeFile(sslManagedPath, sslManagedConfig, "utf8");
      includeSourcePaths.push(sslManagedPath);
    } else {
      note(
        `Keeping the existing remote SSL include for "${siteName}" because the current certificate lineage could not be determined.`,
        "Preserved SSL include"
      );
    }

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

    const deployTarget = formatServerSshTarget(server);
    const includeRsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      server.user === "root"
        ? "mkdir -p /etc/nginx/sitectl-includes && rsync"
        : "sudo mkdir -p /etc/nginx/sitectl-includes && sudo rsync",
      ...includeSourcePaths,
      formatServerRsyncDestination(server, "/etc/nginx/sitectl-includes/")
    ];
    const rsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      server.user === "root" ? "rsync" : "sudo rsync",
      ...rsyncSourcePaths,
      formatServerRsyncDestination(server, "/etc/nginx/sites-available/")
    ];
    const reloadArgs = [
      "-p",
      String(server.port),
      deployTarget,
      server.user === "root"
        ? "nginx -t && systemctl reload nginx"
        : "sudo nginx -t && sudo systemctl reload nginx"
    ];

    await runForegroundCommand("rsync", includeRsyncArgs, { throwOnNonZero: true });
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
