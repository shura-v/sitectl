import { log, outro } from "@clack/prompts";
import { access, cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { simpleGit } from "simple-git";
import { getDataPath } from "../assets.js";
import { FriendlyMessageError, promptConfirm, promptMultiselect, promptText } from "../cli.js";
import { discoverRemoteMenuEntriesInDirectory, type RemoteMenuEntry } from "./remote-commands.js";

export async function runInstallCommand(repositoryUrl?: string): Promise<void> {
  const url =
    repositoryUrl ??
    (await promptText({
      message: "Git repository URL (https or ssh)",
      validate: (value) => (value.trim().length === 0 ? "Value is required." : undefined)
    }));
  const cloneDirectory = await mkdtemp(join(tmpdir(), "sitectl-install-"));

  try {
    log.step(`Cloning ${url.trim()}`);
    await simpleGit().clone(url.trim(), cloneDirectory, ["--depth", "1"]);
    await installRemoteEntriesFlow(join(cloneDirectory, "remote"));
  } finally {
    await rm(cloneDirectory, { recursive: true, force: true });
  }
}

async function installRemoteEntriesFlow(sourceDirectory: string): Promise<void> {
  if (!(await pathExists(sourceDirectory))) {
    throw new FriendlyMessageError('Repository has no "remote/" directory.');
  }

  const entries = await discoverRemoteMenuEntriesInDirectory(sourceDirectory, "");

  if (entries.length === 0) {
    throw new FriendlyMessageError('Repository "remote/" directory has no installable entries.');
  }

  const selectedPaths = await promptMultiselect(
    entries.map((entry) => ({ value: entry.relativePath, label: entry.name, hint: entry.relativePath })),
    "Select remote configurations to install"
  );
  const selected = entries.filter((entry) => selectedPaths.includes(entry.relativePath));
  const targetDirectory = getDataPath("remote");
  const installed = await findInstalledRemoteEntries(targetDirectory, selected);

  if (installed.length > 0) {
    const confirmed = await promptConfirm(
      [
        "These remote configurations already exist and will be overwritten:",
        ...installed.map((entry) => `- ${entry.name} (${entry.relativePath})`),
        "Continue?"
      ].join("\n")
    );

    if (!confirmed) {
      outro("Install cancelled.");
      return;
    }
  }

  await copyRemoteEntries(sourceDirectory, targetDirectory, selected);
  outro(`Installed: ${selected.map((entry) => entry.name).join(", ")}.`);
}

export async function findInstalledRemoteEntries(
  targetDirectory: string,
  entries: RemoteMenuEntry[]
): Promise<RemoteMenuEntry[]> {
  const installed: RemoteMenuEntry[] = [];

  for (const entry of entries) {
    for (const file of getRemoteEntryFiles(entry)) {
      if (await pathExists(join(targetDirectory, file))) {
        installed.push(entry);
        break;
      }
    }
  }

  return installed;
}

export async function copyRemoteEntries(
  sourceDirectory: string,
  targetDirectory: string,
  entries: RemoteMenuEntry[]
): Promise<void> {
  for (const entry of entries) {
    for (const file of getRemoteEntryFiles(entry)) {
      // Replace instead of merge so files removed upstream do not linger locally.
      await rm(join(targetDirectory, file), { recursive: true, force: true });
      await cp(join(sourceDirectory, file), join(targetDirectory, file), { recursive: true });
    }
  }
}

function getRemoteEntryFiles(entry: RemoteMenuEntry): string[] {
  const baseName =
    entry.kind === "submenu" ? entry.relativePath : basename(entry.relativePath, extname(entry.relativePath));
  return [`${baseName}.json`, entry.relativePath];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
