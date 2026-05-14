import { promptSelect } from "../cli.js";
import { readConfig, type ServerConfig } from "../config.js";

export async function resolveServer(
  serverName?: string
): Promise<{ name: string; server: ServerConfig }> {
  const config = await readConfig();
  const names = Object.keys(config.servers).sort();

  if (names.length === 0) {
    throw new Error("No servers found.");
  }

  const resolvedServerName =
    serverName ??
    (await promptSelect(
      names.map((name) => ({
        value: name,
        label: name
      })),
      "Choose a server"
    ));
  const server = config.servers[resolvedServerName];

  if (!server) {
    throw new Error(`Server "${resolvedServerName}" not found.`);
  }

  return {
    name: resolvedServerName,
    server
  };
}
