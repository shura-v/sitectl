import { outro } from "@clack/prompts";
import { ensureDefaultDataFile, readDataText } from "../../assets.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { resolveServer } from "../utils/server-target.js";

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
