import { outro } from "@clack/prompts";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getCaddySitesDirectoryPath, hasCaddySiteConfig, listCaddySites, readCaddySiteConfig } from "../../caddy.js";
import { promptSelect } from "../../cli.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import {
  formatServerRsyncDestination,
  formatServerSshTarget,
  resolveServer
} from "../utils/server-target.js";
import { formatCaddySiteLabel, shellQuote } from "./shared.js";

export async function runCopyCaddyConfFilesToServerAction(): Promise<void> {
  const sites = await listCaddySites();

  if (sites.length === 0) {
    throw new Error(`No Caddy site folders found in ${getCaddySitesDirectoryPath()}.`);
  }

  const siteName = await promptSelect(
    sites.map((site) => ({
      value: site.name,
      label: formatCaddySiteLabel(site.name, site.note)
    })),
    "Choose a site"
  );
  const { name: serverName, server } = await resolveServer();

  if (!(await hasCaddySiteConfig(siteName))) {
    throw new Error(`Missing ${join(getCaddySitesDirectoryPath(), siteName, "Caddyfile")}.`);
  }

  const siteConfig = await readCaddySiteConfig(siteName);
  const workingDirectory = await mkdtemp(join(tmpdir(), "sitectl-caddy-"));

  try {
    const siteConfigPath = join(workingDirectory, `${siteName}.caddyfile`);
    await writeFile(siteConfigPath, siteConfig, "utf8");

    const sudo = server.user === "root" ? "" : "sudo ";
    const rsyncArgs = [
      "-avz",
      "-e",
      `ssh -p ${server.port}`,
      "--chown=root:root",
      "--chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r",
      "--rsync-path",
      `command -v caddy >/dev/null && ${sudo}test -f /etc/caddy/Caddyfile || { echo 'Install Caddy with /etc/caddy/Caddyfile before copying sites.' >&2; exit 1; }; ${sudo}mkdir -p /etc/caddy/sitectl && ${sudo}rsync`,
      siteConfigPath,
      formatServerRsyncDestination(server, `/etc/caddy/sitectl/${siteName}.caddyfile`)
    ];
    const deployTarget = formatServerSshTarget(server);
    const applyConfig = [
      "set -e",
      `if ! grep -Eq ${shellQuote("^[[:space:]]*import[[:space:]]+/etc/caddy/sitectl/\\*\\.caddyfile[[:space:]]*$")} ${shellQuote("/etc/caddy/Caddyfile")}; then`,
      `  printf '\\n# sitectl-managed caddy site imports\\nimport /etc/caddy/sitectl/*.caddyfile\\n' >> ${shellQuote("/etc/caddy/Caddyfile")}`,
      "fi",
      "caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile",
      "state=$(systemctl show caddy --property=ActiveState --value)",
      'case "$state" in',
      "  active) systemctl reload caddy ;;",
      "  inactive) echo 'Caddy is inactive; config validated, reload skipped.' ;;",
      '  *) echo "Cannot reload Caddy: service state is $state." >&2; exit 1 ;;',
      "esac"
    ].join("\n");
    const remoteCommand = `${sudo}sh -c ${shellQuote(applyConfig)}`;

    await runForegroundCommand("rsync", rsyncArgs, { throwOnNonZero: true });
    await runForegroundCommand(
      "ssh",
      ["-p", String(server.port), deployTarget, remoteCommand],
      { throwOnNonZero: true }
    );
    outro(`Caddy config for "${siteName}" copied to "${serverName}".`);
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}
