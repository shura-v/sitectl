import { outro } from "@clack/prompts";
import { readAssetText } from "../assets.js";
import { resolveServer } from "./server-target.js";
import { runRemoteScript } from "./run-remote-script.js";

export async function runSetupUfwCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  const scriptTemplate = await readAssetText("remote/setup-ufw.sh");
  const script = scriptTemplate.replace(
    "__SITECTL_SSH_PORT__",
    String(server.port)
  );

  await runRemoteScript(server, script);
  outro(`UFW configured on "${name}".`);
}
