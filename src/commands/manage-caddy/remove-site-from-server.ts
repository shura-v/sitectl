import { outro } from "@clack/prompts";
import { promptConfirm } from "../../cli.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import { formatServerSshTarget } from "../utils/server-target.js";
import { chooseCaddySiteAndServer, shellQuote } from "./shared.js";

export async function runRemoveCaddySiteFromServerAction(): Promise<void> {
  const { siteName, serverName, server } = await chooseCaddySiteAndServer();
  const approved = await promptConfirm(`Remove Caddy site "${siteName}" from "${serverName}"?`);

  if (!approved) {
    outro("Removal cancelled.");
    return;
  }

  const deployTarget = formatServerSshTarget(server);
  const siteConfigPath = `/etc/caddy/sitectl/${siteName}.caddyfile`;
  const cleanupCommand = [
    `rm -f ${shellQuote(siteConfigPath)}`,
    "caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile",
    "systemctl reload caddy"
  ].join(" && ");
  const remoteCommand =
    server.user === "root"
      ? cleanupCommand
      : `sudo rm -f ${shellQuote(siteConfigPath)} && sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy`;

  await runForegroundCommand(
    "ssh",
    ["-p", String(server.port), deployTarget, remoteCommand],
    { throwOnNonZero: true }
  );

  outro(`Caddy site "${siteName}" removed from "${serverName}". Local config was kept.`);
}
