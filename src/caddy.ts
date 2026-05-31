import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import {
  getDataPath,
  readBundledConfigText,
  readDataText
} from "./assets.js";

const CADDY_SITE_TEMPLATE_RELATIVE_PATH = "caddy/sites/Caddyfile";

export type CaddySiteRecord = {
  name: string;
  note: string | null;
};

export async function listCaddySites(): Promise<CaddySiteRecord[]> {
  const sitesDirectoryPath = getCaddySitesDirectoryPath();
  let entries;

  try {
    entries = await readdir(sitesDirectoryPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const siteNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    siteNames.map(async (name) => ({
      name,
      note: await readCaddySiteNote(name)
    }))
  );
}

export async function readCaddySiteConfig(siteName: string): Promise<string> {
  return readDataText(`caddy/sites/${siteName}/Caddyfile`);
}

export async function readCaddySiteNote(siteName: string): Promise<string | null> {
  try {
    const note = await readFile(getDataPath(`caddy/sites/${siteName}/note.txt`), "utf8");
    const trimmedNote = note.trim();
    return trimmedNote.length > 0 ? trimmedNote : null;
  } catch {
    return null;
  }
}

export async function writeCaddySiteNote(siteName: string, note: string): Promise<void> {
  await createCaddySiteDirectory(siteName);
  const notePath = getDataPath(`caddy/sites/${siteName}/note.txt`);
  await writeFile(notePath, `${note.trim()}\n`, "utf8");
}

export async function hasCaddySiteConfig(siteName: string): Promise<boolean> {
  try {
    await access(getDataPath(`caddy/sites/${siteName}/Caddyfile`));
    return true;
  } catch {
    return false;
  }
}

export async function createCaddySiteDirectory(siteName: string): Promise<string> {
  const siteDirectoryPath = getDataPath(`caddy/sites/${siteName}`);
  await mkdir(siteDirectoryPath, { recursive: true });
  return siteDirectoryPath;
}

export async function seedCaddySiteConfig(siteName: string): Promise<string> {
  const siteConfigPath = getDataPath(`caddy/sites/${siteName}/Caddyfile`);

  if (await hasCaddySiteConfig(siteName)) {
    return siteConfigPath;
  }

  const template = await readCaddySiteTemplate();
  const rendered = renderCaddySiteTemplate(template, siteName);

  await createCaddySiteDirectory(siteName);
  await writeFile(siteConfigPath, rendered, "utf8");

  return siteConfigPath;
}

export function getCaddySitesDirectoryPath(): string {
  return getDataPath("caddy/sites");
}

export function getCaddySiteTemplatePath(): string {
  return getDataPath(CADDY_SITE_TEMPLATE_RELATIVE_PATH);
}

export async function readCaddySiteTemplate(): Promise<string> {
  await ensureCaddySiteTemplateFile();
  return readDataText(CADDY_SITE_TEMPLATE_RELATIVE_PATH);
}

export function renderCaddySiteTemplate(template: string, siteName: string): string {
  return template.replaceAll("__SITE_NAME__", siteName);
}

export async function ensureCaddySiteTemplateFile(): Promise<string> {
  return initializeCaddySiteTemplateFile({ overwrite: false });
}

export async function initializeCaddySiteTemplateFile(options: {
  overwrite: boolean;
}): Promise<string> {
  const templatePath = getCaddySiteTemplatePath();
  const template = await readBundledConfigText("caddy/sites/Caddyfile");

  if (options.overwrite) {
    await mkdir(getCaddySitesDirectoryPath(), { recursive: true });
    await writeFile(templatePath, template, "utf8");
    return templatePath;
  }

  try {
    await access(templatePath);
    return templatePath;
  } catch {
    await mkdir(getCaddySitesDirectoryPath(), { recursive: true });
    await writeFile(templatePath, template, "utf8");
    return templatePath;
  }
}
