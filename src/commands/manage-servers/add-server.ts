import { outro } from "@clack/prompts";
import { promptText } from "../../cli.js";
import { getConfigPath, readConfig, writeConfig } from "../../config.js";
import { promptServerFields } from "./shared.js";

export async function runAddServerCommand(): Promise<void> {
  const config = await readConfig();
  const name = await promptText({
    message: "Server name",
    placeholder: "prod-1",
    validate: (value) => {
      if (value.length === 0) {
        return "Name is required.";
      }

      if (config.servers[value]) {
        return `Server "${value}" already exists.`;
      }

      return undefined;
    }
  });
  const server = await promptServerFields();

  config.servers[name] = server;
  await writeConfig(config);

  outro(`Server "${name}" saved to ${getConfigPath()}.`);
}
