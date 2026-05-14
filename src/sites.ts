import { access, mkdir, readdir, writeFile } from "node:fs/promises";
import {
  ensureDefaultDataFile,
  ensureDataDirectory,
  getDataPath,
  readDataText
} from "./assets.js";

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

export async function seedSiteConfig(siteName: string): Promise<string> {
  const siteConfigPath = getDataPath(`nginx/sites/${siteName}/nginx.conf`);

  if (await hasSiteConfig(siteName)) {
    return siteConfigPath;
  }

  await ensureDefaultDataFile("nginx/nginx.conf", "nginx/nginx.conf");
  const template = await readDataText("nginx/nginx.conf");
  const rendered = template.replaceAll("__SITE_NAME__", siteName);

  await createSiteDirectory(siteName);
  await writeFile(siteConfigPath, rendered, "utf8");

  return siteConfigPath;
}

export function getSitesDirectoryPath(): string {
  return getDataPath("nginx/sites");
}
