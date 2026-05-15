import { runForegroundCommand } from "./utils/run-foreground-command.js";
import { formatServerSshTarget, resolveServer } from "./utils/server-target.js";

export async function runSshCommand(serverName?: string): Promise<void> {
  const { server } = await resolveServer(serverName);

  const sshArgs = ["-p", String(server.port), formatServerSshTarget(server)];
  await runForegroundCommand("ssh", sshArgs);
}
