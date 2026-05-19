import { access, glob } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, posix as pathPosix } from "node:path";
import type { ServerConfig } from "../../config.js";
import { formatServerRsyncDestination } from "./server-target.js";

export function buildRsyncArgs(options: {
  localSourcePath: string;
  remotePath: string;
  server: ServerConfig;
  rsyncPath?: string;
}): string[] {
  const destination = formatServerRsyncDestination(
    options.server,
    quoteRemotePathForRsync(options.remotePath)
  );

  const args = ["-avz", "-e", `ssh -p ${options.server.port}`];

  if (options.rsyncPath) {
    args.push("--rsync-path", options.rsyncPath);
  }

  args.push("--", options.localSourcePath, destination);

  return args;
}

export async function resolveLocalSourcePath(localSourcePath: string): Promise<string> {
  const expandedLocalSourcePath = expandUserPath(localSourcePath);
  const preserveTrailingSlash = localSourcePath.endsWith("/");

  if (await pathExists(expandedLocalSourcePath)) {
    return expandedLocalSourcePath;
  }

  if (!isGlobPattern(expandedLocalSourcePath)) {
    throw new Error(`Local source path not found: ${localSourcePath}`);
  }

  const matches: string[] = [];
  for await (const match of glob(expandedLocalSourcePath)) {
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

export function buildUploadRsyncArgs(options: {
  localSourcePath: string;
  remotePath: string;
  server: ServerConfig;
}): string[] {
  const remoteUploadDirectory = getRemoteUploadDirectory(options.remotePath);
  const rsyncPath = shouldUseSudoForUpload(options.server, remoteUploadDirectory)
    ? `sudo mkdir -p ${quoteRemotePathForShell(remoteUploadDirectory)} && sudo rsync`
    : `mkdir -p ${quoteRemotePathForShell(remoteUploadDirectory)} && rsync`;

  return buildRsyncArgs({
    localSourcePath: options.localSourcePath,
    remotePath: options.remotePath,
    server: options.server,
    rsyncPath
  });
}

export function quoteRemotePathForShell(remotePath: string): string {
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

function quoteRemotePathForRsync(remotePath: string): string {
  return quoteRemotePathForShell(remotePath);
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

function getRemoteUploadDirectory(remotePath: string): string {
  return remotePath.endsWith("/") ? remotePath : dirname(remotePath);
}

function shouldUseSudoForUpload(server: ServerConfig, remoteUploadDirectory: string): boolean {
  if (server.user === "root") {
    return false;
  }

  if (remoteUploadDirectory === "~" || remoteUploadDirectory.startsWith("~/")) {
    return false;
  }

  if (!remoteUploadDirectory.startsWith("/")) {
    return false;
  }

  return !isNonPrivilegedAbsoluteUploadDirectory(remoteUploadDirectory);
}

function isNonPrivilegedAbsoluteUploadDirectory(remoteUploadDirectory: string): boolean {
  return (
    remoteUploadDirectory === "/tmp" ||
    remoteUploadDirectory.startsWith("/tmp/") ||
    remoteUploadDirectory === "/var/tmp" ||
    remoteUploadDirectory.startsWith("/var/tmp/") ||
    remoteUploadDirectory === "/dev/shm" ||
    remoteUploadDirectory.startsWith("/dev/shm/")
  );
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
