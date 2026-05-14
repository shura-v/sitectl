import { outro } from "@clack/prompts";
import { readAssetText } from "../assets.js";
import { resolveServer } from "./server-target.js";
import { runRemoteScript } from "./run-remote-script.js";

export async function runInstallBasePackagesCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  const script = await readAssetText("remote/install-base-packages.sh");

  await runRemoteScript(server, script);
  outro(`Base packages installed on "${name}".`);
}
