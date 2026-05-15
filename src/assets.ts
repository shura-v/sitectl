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
  const sourceRootDirectoryUrl = getBundledConfigDirectoryUrl();
  await seedBundledDirectory(sourceRootDirectoryUrl, sourceRootDirectoryUrl);
}

async function seedBundledDirectory(
  currentSourceDirectoryUrl: URL,
  sourceRootDirectoryUrl: URL
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
        sourceRootDirectoryUrl
      );
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });

    try {
      await access(targetPath);
    } catch {
      await copyFile(sourceEntryUrl, targetPath);
    }
  }
}
