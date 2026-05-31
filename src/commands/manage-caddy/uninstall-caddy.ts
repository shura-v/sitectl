import { outro } from "@clack/prompts";
import { readBundledConfigText } from "../../assets.js";
import { promptConfirm } from "../../cli.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { resolveServer } from "../utils/server-target.js";

export async function runUninstallCaddyAction(): Promise<void> {
  const { name: serverName, server } = await resolveServer();
  const approved = await promptConfirm(
    `Remove Caddy, Caddy configs, certificates, and Caddy data from "${serverName}"?`
  );

  if (!approved) {
    outro("Removal cancelled.");
    return;
  }

  const script = await readBundledConfigText("caddy/uninstall-caddy.sh");
  await runRemoteScript(server, script);
  outro(`Caddy removed from "${serverName}".`);
}
