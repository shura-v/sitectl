import { access, mkdir, readdir } from "node:fs/promises";
import { ensureDataDirectory, getDataPath, readDataText } from "./assets.js";

export async function listSiteNames(): Promise<string[]> {
  const sitesDirectoryPath = await ensureDataDirectory("nginx/sites");
  const entries = await readdir(sitesDirectoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export async function readSiteConfig(siteName: string): Promise<string> {
  return readDataText(`nginx/sites/${siteName}/nginx.conf`);
}

export async function hasSiteConfig(siteName: string): Promise<boolean> {
  try {
    await access(getDataPath(`nginx/sites/${siteName}/nginx.conf`));
    return true;
  } catch {
    return false;
  }
}

export async function createSiteDirectory(siteName: string): Promise<string> {
  const siteDirectoryPath = getDataPath(`nginx/sites/${siteName}`);
  await mkdir(siteDirectoryPath, { recursive: true });
  return siteDirectoryPath;
}

export function getSitesDirectoryPath(): string {
  return getDataPath("nginx/sites");
}
