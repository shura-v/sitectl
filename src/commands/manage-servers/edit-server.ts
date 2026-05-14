import { outro } from "@clack/prompts";
import { promptSelect, promptText } from "../../cli.js";
import { getConfigPath, readConfig, writeConfig } from "../../config.js";
import { formatServerLabel } from "../utils/server-target.js";
import { promptServerFields } from "./shared.js";

export async function runEditServerCommand(): Promise<void> {
  const config = await readConfig();
  const names = Object.keys(config.servers);

  if (names.length === 0) {
    outro(`No servers found in ${getConfigPath()}.`);
    return;
  }

  const currentName = await promptSelect(
    names.map((name) => ({
      value: name,
      label: formatServerLabel(
        name,
        config.servers[name] ?? { flag: "🌍", address: "", port: 22, user: "root" }
      )
    })),
    "Choose a server to edit"
  );
  const currentServer = config.servers[currentName];
  const nextName = await promptText({
    message: "Server name",
    initialValue: currentName,
    validate: (value) => {
      if (value.length === 0) {
        return "Name is required.";
      }

      if (value !== currentName && config.servers[value]) {
        return `Server "${value}" already exists.`;
      }

      return undefined;
    }
  });
  const nextServer = await promptServerFields(currentServer);

  if (nextName !== currentName) {
    delete config.servers[currentName];
  }

  config.servers[nextName] = nextServer;
  await writeConfig(config);

  outro(`Server "${nextName}" updated in ${getConfigPath()}.`);
}
