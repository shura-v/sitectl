import { cancel, outro } from "@clack/prompts";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { posix as pathPosix } from "node:path";
import { getDataPath, readDataText } from "../assets.js";
import type { SelectOption } from "../cli.js";
import {
  FriendlyMessageError,
  isPromptCancelledError,
  promptConfirm,
  promptSelect
} from "../cli.js";
import { buildUploadRsyncArgs, resolveLocalSourcePath } from "./utils/rsync.js";
import { runForegroundCommand } from "./utils/run-foreground-command.js";
import { runRemoteScript } from "./utils/run-remote-script.js";
import { resolveServer } from "./utils/server-target.js";

export type RemoteMenuEntry = RemoteCommandEntry | RemoteSubmenuEntry;

export type RemoteCommandEntry = {
  confirmation?: string;
  kind: "command";
  name: string;
  order?: number;
  relativePath: string;
  run: (serverName?: string) => Promise<void>;
};

export type RemoteSubmenuEntry = {
  kind: "submenu";
  name: string;
  order?: number;
  relativePath: string;
  entries: RemoteMenuEntry[];
};

type RemoteCommandMetadata = {
  confirmation?: string;
  hidden?: boolean;
  name: string;
  order?: number;
  uploads?: RemoteCommandUpload[];
};

type RemoteCommandUpload = {
  from: string;
  to: string;
};

export async function runRemoteCommandsFlow(): Promise<void> {
  const entries = await discoverRemoteMenuEntries();
  await runRemoteMenuFlow({
    title: "Remote commands",
    backTarget: "the main menu",
    entries
  });
}

export async function discoverRemoteMenuEntries(): Promise<RemoteMenuEntry[]> {
  return discoverRemoteMenuEntriesInDirectory(getDataPath("remote"), "");
}

export async function runRemoteCommandByFilePathSegments(
  pathSegments: string[],
  serverName: string
): Promise<void> {
  if (pathSegments.length === 0) {
    throw new Error("Remote command path is required.");
  }

  const resolution = resolveRemoteMenuEntryByFilePathSegments(
    await discoverRemoteMenuEntries(),
    pathSegments
  );

  if (!resolution.entry) {
    throw new FriendlyMessageError(buildRemoteCommandResolutionError(pathSegments, resolution));
  }

  if (resolution.entry.kind !== "command") {
    throw new FriendlyMessageError(buildRemoteCommandResolutionError(pathSegments, resolution));
  }

  await resolution.entry.run(serverName);
}

export async function discoverRemoteMenuEntriesInDirectory(
  directoryPath: string,
  relativeDirectoryPath: string
): Promise<RemoteMenuEntry[]> {
  const directoryEntries = await readdir(directoryPath, { withFileTypes: true });
  const metadataEntries = directoryEntries.filter(
    (entry) => entry.isFile() && extname(entry.name) === ".json"
  );
  const discoveredEntries: RemoteMenuEntry[] = [];

  for (const metadataEntry of metadataEntries) {
    const baseName = basename(metadataEntry.name, ".json");
    const relativeItemPath = joinRemotePath(relativeDirectoryPath, baseName);
    const metadata = await readRemoteCommandMetadata(
      join(directoryPath, metadataEntry.name),
      join(relativeDirectoryPath, metadataEntry.name)
    );

    if (metadata.hidden) {
      continue;
    }

    const matchingDirectory = directoryEntries.find(
      (entry) => entry.isDirectory() && entry.name === baseName
    );
    const matchingCommandFiles = directoryEntries.filter(
      (entry) =>
        entry.isFile() &&
        extname(entry.name) !== ".json" &&
        basename(entry.name, extname(entry.name)) === baseName
    );

    if (matchingDirectory && matchingCommandFiles.length > 0) {
      throw new Error(
        `Remote item "${relativeItemPath}" cannot be both a submenu and a command.`
      );
    }

    if (matchingDirectory) {
      discoveredEntries.push({
        kind: "submenu",
        name: metadata.name,
        order: metadata.order,
        relativePath: relativeItemPath,
        entries: await discoverRemoteMenuEntriesInDirectory(
          join(directoryPath, baseName),
          relativeItemPath
        )
      });
      continue;
    }

    if (matchingCommandFiles.length === 0) {
      throw new Error(
        `Remote metadata "${joinRemotePath(relativeDirectoryPath, metadataEntry.name)}" has no matching command file or submenu directory.`
      );
    }

    if (matchingCommandFiles.length > 1) {
      throw new Error(
        `Remote command "${relativeItemPath}" has multiple matching files: ${matchingCommandFiles.map((entry) => entry.name).join(", ")}.`
      );
    }

    const commandRelativePath = joinRemotePath(relativeDirectoryPath, matchingCommandFiles[0]!.name);
    discoveredEntries.push({
      kind: "command",
      confirmation: metadata.confirmation,
      name: metadata.name,
      order: metadata.order,
      relativePath: commandRelativePath,
      run: buildRemoteCommandRunner(
        commandRelativePath,
        metadata.name,
        metadata.confirmation,
        metadata.uploads
      )
    });
  }

  return discoveredEntries.sort(compareRemoteMenuEntries);
}

export function findRemoteMenuEntryByFilePathSegments(
  entries: RemoteMenuEntry[],
  pathSegments: string[]
): RemoteMenuEntry | undefined {
  return resolveRemoteMenuEntryByFilePathSegments(entries, pathSegments).entry;
}

export function formatRunnableRemoteCommandList(entries: RemoteMenuEntry[]): string {
  const commands = collectRunnableRemoteCommands(entries);

  if (commands.length === 0) {
    return "(empty)";
  }

  return commands.map((command) => `- ${command.path}: ${command.name}`).join("\n");
}

export function shouldPromptForRemoteCommandConfirmation(serverName?: string): boolean {
  return serverName === undefined;
}

export function buildRemoteCommandResolutionError(
  pathSegments: string[],
  resolution: {
    availableEntries: RemoteMenuEntry[];
    entry?: RemoteMenuEntry;
    resolvedSegments: string[];
  }
): string {
  if (!resolution.entry) {
    return [
      `Remote command not found: ${formatRemoteCommandFilePath(pathSegments)}.`,
      `Available entries in ${formatRemoteCommandLocation(resolution.resolvedSegments)}:`,
      formatRemoteEntryList(resolution.availableEntries)
    ].join("\n");
  }

  if (resolution.entry.kind !== "command") {
    return [
      `Remote command path points to a submenu, not a command: ${formatRemoteCommandFilePath(pathSegments)}.`,
      `Available entries in ${formatRemoteCommandLocation(pathSegments)}:`,
      formatRemoteEntryList(resolution.entry.entries)
    ].join("\n");
  }

  return `Remote command path did not resolve to a runnable command: ${formatRemoteCommandFilePath(pathSegments)}.`;
}

export function resolveRemoteMenuEntryByFilePathSegments(
  entries: RemoteMenuEntry[],
  pathSegments: string[]
): {
  availableEntries: RemoteMenuEntry[];
  entry?: RemoteMenuEntry;
  resolvedSegments: string[];
} {
  let currentEntries = entries;
  let currentEntry: RemoteMenuEntry | undefined;
  const resolvedSegments: string[] = [];

  for (const segment of pathSegments) {
    currentEntry = currentEntries.find((entry) => getRemoteEntryPathSegment(entry) === segment);

    if (!currentEntry) {
      return {
        availableEntries: currentEntries,
        resolvedSegments
      };
    }

    resolvedSegments.push(segment);
    currentEntries = currentEntry.kind === "submenu" ? currentEntry.entries : [];
  }

  return {
    availableEntries: currentEntries,
    entry: currentEntry,
    resolvedSegments
  };
}

async function runRemoteMenuFlow(options: {
  title: string;
  backTarget: string;
  entries: RemoteMenuEntry[];
}): Promise<void> {
  while (true) {
    const selected = await promptForRemoteMenuSelection(
      options.entries,
      options.title,
      options.backTarget
    );

    if (!selected) {
      return;
    }

    try {
      if (selected.kind === "submenu") {
        await runRemoteMenuFlow({
          title: selected.name,
          backTarget: options.title,
          entries: selected.entries
        });
        continue;
      }

      await selected.run();
    } catch (error) {
      if (isPromptCancelledError(error)) {
        continue;
      }

      cancel(error instanceof Error ? error.message : "Unknown error.");
    }
  }
}

async function readRemoteCommandMetadata(
  metadataPath: string,
  displayPath: string
): Promise<RemoteCommandMetadata> {
  const contents = await readFile(metadataPath, "utf8");
  const parsed = JSON.parse(contents) as Partial<RemoteCommandMetadata>;

  if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) {
    throw new Error(`Remote metadata "${displayPath}" must contain a non-empty "name".`);
  }

  if (parsed.hidden !== undefined && typeof parsed.hidden !== "boolean") {
    throw new Error(
      `Remote metadata "${displayPath}" must contain a boolean "hidden" when provided.`
    );
  }

  if (parsed.confirmation !== undefined && typeof parsed.confirmation !== "string") {
    throw new Error(
      `Remote metadata "${displayPath}" must contain a string "confirmation" when provided.`
    );
  }

  if (parsed.order !== undefined && typeof parsed.order !== "number") {
    throw new Error(`Remote metadata "${displayPath}" must contain a numeric "order" when provided.`);
  }

  if (parsed.uploads !== undefined) {
    if (!Array.isArray(parsed.uploads)) {
      throw new Error(`Remote metadata "${displayPath}" must contain an array "uploads" when provided.`);
    }

    for (const [index, upload] of parsed.uploads.entries()) {
      if (!upload || typeof upload !== "object" || Array.isArray(upload)) {
        throw new Error(
          `Remote metadata "${displayPath}" upload #${index + 1} must be an object with non-empty "from" and "to" strings.`
        );
      }

      if (typeof upload.from !== "string" || upload.from.trim().length === 0) {
        throw new Error(
          `Remote metadata "${displayPath}" upload #${index + 1} must contain a non-empty "from" string.`
        );
      }

      if (typeof upload.to !== "string" || upload.to.trim().length === 0) {
        throw new Error(
          `Remote metadata "${displayPath}" upload #${index + 1} must contain a non-empty "to" string.`
        );
      }
    }
  }

  return {
    confirmation: parsed.confirmation?.trim() || undefined,
    hidden: parsed.hidden ?? false,
    name: parsed.name.trim(),
    order: parsed.order,
    uploads: parsed.uploads?.map((upload) => ({
      from: upload.from.trim(),
      to: upload.to.trim()
    }))
  };
}

async function promptForRemoteMenuSelection(
  entries: RemoteMenuEntry[],
  title: string,
  backTarget: string
): Promise<RemoteMenuEntry | null> {
  try {
    const selected = await promptSelect(
      [
        ...entries.map<SelectOption<string>>((entry) => ({
          value: entry.relativePath,
          label: entry.name,
          hint: entry.kind === "submenu" ? "Open submenu" : "Run on a selected server"
        })),
        {
          value: "__back__",
          label: "Back",
          hint: `Return to ${backTarget}`
        }
      ],
      title
    );

    if (selected === "__back__") {
      return null;
    }

    const entry = entries.find((candidate) => candidate.relativePath === selected);

    if (!entry) {
      throw new Error(`Unknown remote item: ${selected}`);
    }

    return entry;
  } catch (error) {
    if (isPromptCancelledError(error)) {
      return null;
    }

    throw error;
  }
}

function compareRemoteMenuEntries(left: RemoteMenuEntry, right: RemoteMenuEntry): number {
  const leftOrder = left.order ?? Number.POSITIVE_INFINITY;
  const rightOrder = right.order ?? Number.POSITIVE_INFINITY;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.name.localeCompare(right.name);
}

function joinRemotePath(...segments: string[]): string {
  return pathPosix.join(...segments.filter((segment) => segment.length > 0));
}

function formatRemoteCommandFilePath(pathSegments: string[]): string {
  return pathSegments.join("/");
}

function formatRemoteCommandLocation(pathSegments: string[]): string {
  return pathSegments.length === 0 ? "remote/" : `remote/${formatRemoteCommandFilePath(pathSegments)}/`;
}

function formatRemoteEntryList(entries: RemoteMenuEntry[]): string {
  if (entries.length === 0) {
    return "(empty)";
  }

  return entries
    .map((entry) => {
      const kindDescription = entry.kind === "submenu" ? "submenu" : "command";
      return `- ${getRemoteEntryPathSegment(entry)}: ${entry.name} (${kindDescription})`;
    })
    .join("\n");
}

function collectRunnableRemoteCommands(
  entries: RemoteMenuEntry[],
  prefix: string[] = []
): Array<{ name: string; path: string }> {
  const commands: Array<{ name: string; path: string }> = [];

  for (const entry of entries) {
    const nextPath = [...prefix, getRemoteEntryPathSegment(entry)];

    if (entry.kind === "command") {
      commands.push({
        name: entry.name,
        path: nextPath.join("/")
      });
      continue;
    }

    commands.push(...collectRunnableRemoteCommands(entry.entries, nextPath));
  }

  return commands;
}

function getRemoteEntryPathSegment(entry: RemoteMenuEntry): string {
  const entryPath = entry.relativePath.split("/").at(-1) ?? entry.relativePath;
  return entry.kind === "command" ? basename(entryPath, extname(entryPath)) : entryPath;
}

function buildRemoteCommandRunner(
  relativePath: string,
  name: string,
  confirmation?: string,
  uploads: RemoteCommandUpload[] = []
): (serverName?: string) => Promise<void> {
  return async (serverName?: string) => {
    const { name: resolvedServerName, server } = await resolveServer(serverName);
    if (confirmation && shouldPromptForRemoteCommandConfirmation(serverName)) {
      const confirmed = await promptConfirm(`${confirmation}\nServer: ${resolvedServerName}`);

      if (!confirmed) {
        throw new Error(`${name} cancelled.`);
      }
    }

    for (const upload of uploads) {
      const resolvedLocalSourcePath = await resolveLocalSourcePath(upload.from);
      const rsyncArgs = buildUploadRsyncArgs({
        localSourcePath: resolvedLocalSourcePath,
        remotePath: upload.to,
        server
      });

      await runForegroundCommand("rsync", rsyncArgs, {
        throwOnNonZero: true
      });
    }

    const script = await readDataText(join("remote", relativePath));
    await runRemoteScript(server, script, {
      env: {
        SITECTL_SERVER_ADDRESS: server.address,
        SITECTL_SERVER_FLAG: server.flag,
        SITECTL_SERVER_NAME: resolvedServerName,
        SITECTL_SERVER_PORT: String(server.port),
        SITECTL_SERVER_USER: server.user
      }
    });
    outro(`${name} completed on "${resolvedServerName}".`);
  };
}
