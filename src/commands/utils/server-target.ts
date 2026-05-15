import { promptSelect } from "../../cli.js";
import { readConfig, type ServerConfig } from "../../config.js";
import { detectHostKind, normalizeHostValue } from "../../hosts.js";

export async function resolveServer(
  serverName?: string
): Promise<{ name: string; server: ServerConfig }> {
  const config = await readConfig();
  const names = Object.keys(config.servers);

  if (names.length === 0) {
    throw new Error("No servers found.");
  }

  const resolvedServerName =
    serverName ??
    (await promptSelect(
      names.map((name) => ({
        value: name,
        label: formatServerLabel(name, config.servers[name] ?? { flag: "🌍" } as ServerConfig)
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

export function formatServerLabel(name: string, server: ServerConfig): string {
  return `${server.flag} ${name}`;
}

export function formatRsyncHost(address: string): string {
  const normalizedAddress = normalizeHostValue(address);
  return detectHostKind(normalizedAddress) === "ipv6" ? `[${normalizedAddress}]` : normalizedAddress;
}

export function formatServerSshTarget(server: ServerConfig): string {
  return `${server.user}@${normalizeHostValue(server.address)}`;
}

export function formatServerRsyncDestination(server: ServerConfig, path: string): string {
  return `${server.user}@${formatRsyncHost(server.address)}:${path}`;
}
