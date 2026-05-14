import { platform } from "node:os";
import { runForegroundCommand } from "./run-foreground-command.js";

export async function openLocalPath(path: string): Promise<void> {
  const opener = getOpenCommand();

  await runForegroundCommand(opener.command, [...opener.args, path], {
    throwOnNonZero: true
  });
}

function getOpenCommand(): { command: string; args: string[] } {
  switch (platform()) {
    case "darwin":
      return {
        command: "open",
        args: []
      };
    case "linux":
      return {
        command: "xdg-open",
        args: []
      };
    default:
      throw new Error("Opening local files is not supported on this platform.");
  }
}
