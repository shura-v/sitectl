import { runForegroundCommand } from "./run-foreground-command.js";
import { resolveServer } from "./server-target.js";

export async function runSshCommand(serverName?: string): Promise<void> {
  const { server } = await resolveServer(serverName);

  const sshArgs = ["-p", String(server.port), `${server.user}@${server.address}`];
  await runForegroundCommand("ssh", sshArgs);
}
