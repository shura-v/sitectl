import { note, outro } from "@clack/prompts";
import { promptText } from "../../cli.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import { buildRsyncArgs, resolveLocalSourcePath } from "../utils/rsync.js";
import { resolveServer } from "../utils/server-target.js";

export async function runSyncFilesToServerCommand(): Promise<void> {
  note(
    [
      "Examples:",
      "./file.txt",
      "./My App/build.tgz",
      "./dist/*.tgz if it resolves to exactly one file",
      "./assets copies the folder itself",
      "./assets/ copies only the folder contents",
      "Use exactly one local file or directory path"
    ].join("\n"),
    "Local source path"
  );

  const localSourcePath = await promptText({
    message: "Local source path",
    placeholder: "./file.txt",
    validate: (value) => {
      const normalizedValue = value.trim();

      if (normalizedValue.length === 0) {
        return "A local source path is required.";
      }

      return undefined;
    }
  });
  note(
    [
      "Examples:",
      "/opt/db may become a file path if it does not already exist as a directory",
      "/opt/db/ always means copy into the /opt/db directory",
      "~/uploads/ copies into the remote home directory",
      "Create the destination directory yourself first when rsync requires it"
    ].join("\n"),
    "Destination path hint"
  );
  const remotePath = await promptText({
    message: "Remote destination path",
    placeholder: "/opt/db/",
    validate: (value) => {
      if (value.trim().length === 0) {
        return "Remote destination path is required.";
      }

      return undefined;
    }
  });
  const { name: serverName, server } = await resolveServer();
  const normalizedRemotePath = remotePath.trim();
  const resolvedLocalSourcePath = await resolveLocalSourcePath(localSourcePath.trim());
  const rsyncArgs = buildRsyncArgs({
    localSourcePath: resolvedLocalSourcePath,
    remotePath: normalizedRemotePath,
    server
  });
  await runForegroundCommand("rsync", rsyncArgs, {
    throwOnNonZero: true
  });

  outro(`Files synced to "${serverName}:${normalizedRemotePath}".`);
}

export { buildRsyncArgs, resolveLocalSourcePath } from "../utils/rsync.js";
