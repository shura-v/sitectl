import { mkdir } from "node:fs/promises";
import { outro } from "@clack/prompts";
import { platform } from "node:os";
import { getDataDirectoryPath } from "../config.js";
import { runForegroundCommand } from "./run-foreground-command.js";

export async function runOpenDataDirCommand(): Promise<void> {
  const dataDirectoryPath = getDataDirectoryPath();
  await mkdir(dataDirectoryPath, { recursive: true });

  const opener = getOpenCommand();

  await runForegroundCommand(opener.command, [...opener.args, dataDirectoryPath], {
    throwOnNonZero: true
  });
  outro(`Opened ${dataDirectoryPath}.`);
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
      throw new Error("Opening the data directory is not supported on this platform.");
  }
}
