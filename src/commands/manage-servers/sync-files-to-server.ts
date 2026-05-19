import { access, glob } from "node:fs/promises";
import { note, outro } from "@clack/prompts";
import { promptText } from "../../cli.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import {
  formatServerRsyncDestination,
  resolveServer
} from "../utils/server-target.js";

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

export function buildRsyncArgs(options: {
  localSourcePath: string;
  remotePath: string;
  server: Awaited<ReturnType<typeof resolveServer>>["server"];
}): string[] {
  const destination = formatServerRsyncDestination(
    options.server,
    quoteRemotePathForRsync(options.remotePath)
  );

  return [
    "-avz",
    "-e",
    `ssh -p ${options.server.port}`,
    "--",
    options.localSourcePath,
    destination
  ];
}

export async function resolveLocalSourcePath(localSourcePath: string): Promise<string> {
  const preserveTrailingSlash = localSourcePath.endsWith("/");

  if (await pathExists(localSourcePath)) {
    return localSourcePath;
  }

  if (!isGlobPattern(localSourcePath)) {
    throw new Error(`Local source path not found: ${localSourcePath}`);
  }

  const matches: string[] = [];
  for await (const match of glob(localSourcePath)) {
    matches.push(match);
  }

  if (matches.length === 0) {
    throw new Error(`Local source pattern matched nothing: ${localSourcePath}`);
  }

  if (matches.length > 1) {
    throw new Error(
      `Local source pattern matched multiple paths, but sync supports only one source: ${localSourcePath}`
    );
  }

  return preserveTrailingSlash ? `${matches[0]!}/` : matches[0]!;
}

function quoteRemotePathForRsync(remotePath: string): string {
  if (remotePath === "~" || remotePath === "/") {
    return remotePath;
  }

  let prefix = "";
  let remainder = remotePath;

  if (remainder.startsWith("~/")) {
    prefix = "~/";
    remainder = remainder.slice(2);
  } else if (remainder.startsWith("/")) {
    prefix = "/";
    remainder = remainder.slice(1);
  }

  const hasTrailingSlash = remainder.endsWith("/");
  const segments = remainder
    .split("/")
    .filter((segment) => segment.length > 0)
    .map(quoteRemotePathSegment);
  const quotedPath = `${prefix}${segments.join("/")}`;

  if (!hasTrailingSlash || quotedPath.length === 0) {
    return quotedPath;
  }

  return `${quotedPath}/`;
}

function isGlobPattern(value: string): boolean {
  return /[*?[]/.test(value);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function quoteRemotePathSegment(segment: string): string {
  return /^[A-Za-z0-9._-]+$/.test(segment) ? segment : shellQuote(segment);
}
