import { outro } from "@clack/prompts";
import { ensureDefaultDataFile, readDataText } from "../assets.js";
import { resolveServer } from "./server-target.js";
import { runRemoteScript } from "./run-remote-script.js";

export async function runInstallBasePackagesCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  await ensureDefaultDataFile(
    "remote/install-base-packages.sh",
    "remote/install-base-packages.sh"
  );
  const script = await readDataText("remote/install-base-packages.sh");

  await runRemoteScript(server, script);
  outro(`Base packages installed on "${name}".`);
}
