import { outro } from "@clack/prompts";
import { readBundledConfigText } from "../../assets.js";
import { promptConfirm } from "../../cli.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { resolveServer } from "../utils/server-target.js";

export async function runUninstallNginxStackAction(): Promise<void> {
  const { name: serverName, server } = await resolveServer();
  const approved = await promptConfirm(
    `Remove nginx, nginx configs, certbot, Let's Encrypt data, and cert-related dependencies from "${serverName}"?`
  );

  if (!approved) {
    outro("Removal cancelled.");
    return;
  }

  const script = await readBundledConfigText("nginx/uninstall-stack.sh");
  await runRemoteScript(server, script);
  outro(`Nginx stack removed from "${serverName}".`);
}
