import { outro } from "@clack/prompts";
import { ensureDefaultDataFile, readDataText } from "../../assets.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { resolveServer } from "../utils/server-target.js";

export async function runSetupUfwCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  await ensureDefaultDataFile("remote/setup-ufw.sh", "remote/setup-ufw.sh");
  const scriptTemplate = await readDataText("remote/setup-ufw.sh");
  const script = scriptTemplate.replace(
    "__SITECTL_SSH_PORT__",
    String(server.port)
  );

  await runRemoteScript(server, script);
  outro(`UFW configured on "${name}".`);
}
