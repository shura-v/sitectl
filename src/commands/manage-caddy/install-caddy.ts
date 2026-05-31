import { outro } from "@clack/prompts";
import { readBundledConfigText } from "../../assets.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { resolveServer } from "../utils/server-target.js";

export async function runInstallCaddyAction(): Promise<void> {
  const { name: serverName, server } = await resolveServer();
  const script = await readBundledConfigText("caddy/install-caddy.sh");
  await runRemoteScript(server, script);
  outro(`Caddy installed on "${serverName}".`);
}
