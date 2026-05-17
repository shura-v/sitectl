import { cancel, outro } from "@clack/prompts";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { posix as pathPosix } from "node:path";
import { getDataPath, readDataText } from "../assets.js";
import type { SelectOption } from "../cli.js";
import { isPromptCancelledError, promptConfirm, promptSelect } from "../cli.js";
import { runRemoteScript } from "./utils/run-remote-script.js";
import { resolveServer } from "./utils/server-target.js";

export type RemoteMenuEntry = RemoteCommandEntry | RemoteSubmenuEntry;

export type RemoteCommandEntry = {
  confirmation?: string;
  kind: "command";
  name: string;
  order?: number;
  relativePath: string;
  run: () => Promise<void>;
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
      run: buildRemoteCommandRunner(commandRelativePath, metadata.name, metadata.confirmation)
    });
  }

  return discoveredEntries.sort(compareRemoteMenuEntries);
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

  return {
    confirmation: parsed.confirmation?.trim() || undefined,
    hidden: parsed.hidden ?? false,
    name: parsed.name.trim(),
    order: parsed.order
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

function buildRemoteCommandRunner(
  relativePath: string,
  name: string,
  confirmation?: string
): () => Promise<void> {
  return async () => {
    const { name: serverName, server } = await resolveServer();
    if (confirmation) {
      const confirmed = await promptConfirm(`${confirmation}\nServer: ${serverName}`);

      if (!confirmed) {
        throw new Error(`${name} cancelled.`);
      }
    }

    const script = await readDataText(join("remote", relativePath));
    await runRemoteScript(server, script, {
      env: {
        SITECTL_SERVER_ADDRESS: server.address,
        SITECTL_SERVER_FLAG: server.flag,
        SITECTL_SERVER_NAME: serverName,
        SITECTL_SERVER_PORT: String(server.port),
        SITECTL_SERVER_USER: server.user
      }
    });
    outro(`${name} completed on "${serverName}".`);
  };
}
