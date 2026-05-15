import { homedir } from "node:os";
import { join } from "node:path";
import { promptText } from "../cli.js";
import { runForegroundCommand } from "./utils/run-foreground-command.js";
import { formatServerSshTarget, resolveServer } from "./utils/server-target.js";

export async function runSshCopyIdCommand(): Promise<void> {
  const { server } = await resolveServer();
  const publicKeyPathInput = await promptText({
    message: "Public key path",
    placeholder: "(auto detect)"
  });
  const sshCopyIdArgs = ["-o", "ForwardAgent=no", "-p", String(server.port)];

  if (publicKeyPathInput.length > 0) {
    sshCopyIdArgs.push("-i", expandUserPath(publicKeyPathInput));
  }

  sshCopyIdArgs.push(formatServerSshTarget(server));

  await runForegroundCommand("ssh-copy-id", sshCopyIdArgs);
}

function expandUserPath(path: string): string {
  if (path === "~") {
    return homedir();
  }

  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }

  return path;
}
