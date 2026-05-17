import { access, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { getDataDirectoryPath } from "./config.js";

export async function readBundledConfigText(relativePath: string): Promise<string> {
  const configUrl = new URL(`../config/${relativePath}`, import.meta.url);
  return readFile(configUrl, "utf8");
}

function getBundledConfigDirectoryUrl(): URL {
  return new URL("../config/", import.meta.url);
}

export function getDataPath(relativePath: string): string {
  return join(getDataDirectoryPath(), relativePath);
}

export async function ensureDefaultDataFile(
  relativePath: string,
  bundledRelativePath: string
): Promise<string> {
  const dataPath = getDataPath(relativePath);

  try {
    await access(dataPath);
    return dataPath;
  } catch {
    const contents = await readBundledConfigText(bundledRelativePath);
    await mkdir(dirname(dataPath), { recursive: true });
    await writeFile(dataPath, contents, "utf8");
    return dataPath;
  }
}

export async function ensureDataDirectory(relativePath: string): Promise<string> {
  const dataPath = getDataPath(relativePath);
  await mkdir(dataPath, { recursive: true });
  return dataPath;
}

export async function readDataText(relativePath: string): Promise<string> {
  return readFile(getDataPath(relativePath), "utf8");
}

export async function ensureBundledDataFiles(): Promise<void> {
  await seedBundledDataFiles({ overwrite: false });
}

export async function seedBundledDataFiles(options: {
  overwrite: boolean;
}): Promise<void> {
  const sourceRootDirectoryUrl = getBundledConfigDirectoryUrl();
  await seedBundledDirectory(sourceRootDirectoryUrl, sourceRootDirectoryUrl, options);
}

export async function hasDataDirectory(): Promise<boolean> {
  try {
    await access(getDataDirectoryPath());
    return true;
  } catch {
    return false;
  }
}

export async function hasRequiredBundledDataFiles(): Promise<boolean> {
  const requiredPaths = [
    "remote/install-base-packages.json",
    "remote/configure-zsh.json",
    "remote/setup-ufw.json",
    "remote/docker.json",
    "remote/docker/install-docker.json",
    "remote/docker/uninstall-docker.json"
  ];

  for (const relativePath of requiredPaths) {
    try {
      await access(getDataPath(relativePath));
    } catch {
      return false;
    }
  }

  return true;
}

async function seedBundledDirectory(
  currentSourceDirectoryUrl: URL,
  sourceRootDirectoryUrl: URL,
  options: {
    overwrite: boolean;
  }
): Promise<void> {
  const entries = await readdir(currentSourceDirectoryUrl, { withFileTypes: true });
  const sourceRootDirectoryPath = fileURLToPath(sourceRootDirectoryUrl);

  for (const entry of entries) {
    if (entry.name === ".DS_Store") {
      continue;
    }

    const sourceEntryUrl = new URL(entry.name, currentSourceDirectoryUrl);
    const relativePath = relative(sourceRootDirectoryPath, fileURLToPath(sourceEntryUrl));

    if (
      relativePath === "nginx/http.conf" ||
      relativePath === "nginx/https.conf" ||
      relativePath === "nginx/acme-challenge.conf" ||
      relativePath === "nginx/ssl-managed.conf"
    ) {
      continue;
    }

    const targetPath = getDataPath(relativePath);

    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await seedBundledDirectory(
        new URL(`${entry.name}/`, currentSourceDirectoryUrl),
        sourceRootDirectoryUrl,
        options
      );
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });

    if (options.overwrite) {
      await copyFile(sourceEntryUrl, targetPath);
      continue;
    }

    try {
      await access(targetPath);
    } catch {
      await copyFile(sourceEntryUrl, targetPath);
    }
  }
}
