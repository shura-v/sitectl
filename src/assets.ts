import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getDataDirectoryPath } from "./config.js";

export async function readBundledConfigText(relativePath: string): Promise<string> {
  const configUrl = new URL(`../config/${relativePath}`, import.meta.url);
  return readFile(configUrl, "utf8");
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
