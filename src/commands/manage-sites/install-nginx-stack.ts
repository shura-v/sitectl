import { outro } from "@clack/prompts";
import { readBundledConfigText } from "../../assets.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { resolveServer } from "../utils/server-target.js";

export async function runInstallNginxStackAction(): Promise<void> {
  const { name: serverName, server } = await resolveServer();
  const script = await readBundledConfigText("nginx/install-stack.sh");
  await runRemoteScript(server, script);
  outro(`Nginx stack installed on "${serverName}".`);
}
