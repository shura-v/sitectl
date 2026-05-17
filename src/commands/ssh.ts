import type { ServerConfig } from "../config.js";
import { runForegroundCommand } from "./utils/run-foreground-command.js";
import { formatServerSshTarget, resolveServer } from "./utils/server-target.js";

export async function runSshCommand(
  serverName?: string,
  remoteCommand?: string
): Promise<void> {
  const { server } = await resolveServer(serverName);

  const sshArgs = buildSshArgs(server, remoteCommand);
  await runForegroundCommand("ssh", sshArgs);
}

export function buildSshArgs(
  server: ServerConfig,
  remoteCommand?: string
): string[] {
  const sshArgs = ["-p", String(server.port), formatServerSshTarget(server)];

  if (remoteCommand) {
    sshArgs.push(remoteCommand);
  }

  return sshArgs;
}
