import { outro } from "@clack/prompts";
import { promptConfirm, promptSelect } from "../../cli.js";
import { getConfigPath, readConfig, writeConfig } from "../../config.js";
import { formatServerLabel } from "../utils/server-target.js";

export async function runDeleteServerCommand(): Promise<void> {
  const config = await readConfig();
  const names = Object.keys(config.servers).sort();

  if (names.length === 0) {
    outro(`No servers found in ${getConfigPath()}.`);
    return;
  }

  const name = await promptSelect(
    names.map((serverName) => ({
      value: serverName,
      label: formatServerLabel(
        serverName,
        config.servers[serverName] ?? {
          flag: "🌍",
          address: "",
          port: 22,
          user: "root"
        }
      )
    })),
    "Choose a server to delete"
  );
  const approved = await promptConfirm(
    `Delete server "${name}" from ${getConfigPath()}?`
  );

  if (!approved) {
    outro("Deletion cancelled.");
    return;
  }

  delete config.servers[name];
  await writeConfig(config);

  outro(`Server "${name}" deleted from ${getConfigPath()}.`);
}
