import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import {
  getDataPath,
  readBundledConfigText,
  readDataText
} from "./assets.js";
import { formatNginxServerName } from "./hosts.js";

const SITE_TEMPLATE_RELATIVE_PATH = "nginx/sites/nginx-template.conf";

export type SiteRecord = {
  name: string;
  note: string | null;
};

export async function listSiteNames(): Promise<string[]> {
  const sites = await listSites();
  return sites.map((site) => site.name);
}

export async function listSites(): Promise<SiteRecord[]> {
  const sitesDirectoryPath = getSitesDirectoryPath();
  const entries = await readdir(sitesDirectoryPath, { withFileTypes: true });
  const siteNames = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    siteNames.map(async (name) => ({
      name,
      note: await readSiteNote(name)
    }))
  );
}

export async function readSiteConfig(siteName: string): Promise<string> {
  return readDataText(`nginx/sites/${siteName}/nginx.conf`);
}

export async function readSiteNote(siteName: string): Promise<string | null> {
  try {
    const note = await readFile(getDataPath(`nginx/sites/${siteName}/note.txt`), "utf8");
    const trimmedNote = note.trim();
    return trimmedNote.length > 0 ? trimmedNote : null;
  } catch {
    return null;
  }
}

export async function writeSiteNote(siteName: string, note: string): Promise<void> {
  await createSiteDirectory(siteName);
  const notePath = getDataPath(`nginx/sites/${siteName}/note.txt`);
  await writeFile(notePath, `${note.trim()}\n`, "utf8");
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

  const template = await readSiteTemplate();
  const rendered = renderSiteTemplate(template, siteName);

  await createSiteDirectory(siteName);
  await writeFile(siteConfigPath, rendered, "utf8");

  return siteConfigPath;
}

export function getSitesDirectoryPath(): string {
  return getDataPath("nginx/sites");
}

export function getSiteTemplatePath(): string {
  return getDataPath(SITE_TEMPLATE_RELATIVE_PATH);
}

export async function readSiteTemplate(): Promise<string> {
  await ensureSiteTemplateFile();
  return readDataText(SITE_TEMPLATE_RELATIVE_PATH);
}

export async function readBundledBootstrapTemplate(): Promise<string> {
  return readBundledConfigText("nginx/http.conf");
}

export async function readBundledDefaultSiteTemplate(): Promise<string> {
  const [httpTemplate, httpsTemplate] = await Promise.all([
    readBundledConfigText("nginx/http.conf"),
    readBundledConfigText("nginx/https.conf")
  ]);

  return joinTemplateSections(httpTemplate, httpsTemplate);
}

export async function readBundledSslManagedTemplate(): Promise<string> {
  return readBundledConfigText("nginx/ssl-managed.conf");
}

export function renderSiteTemplate(template: string, siteName: string): string {
  return template
    .replaceAll("server_name __SITE_NAME__;", `server_name ${formatNginxServerName(siteName)};`)
    .replaceAll("__SERVER_NAME__", formatNginxServerName(siteName))
    .replaceAll("__SITE_NAME__", siteName);
}

export function renderSslManagedTemplate(template: string, lineage: string): string {
  return template.replaceAll("__SITE_NAME__", lineage);
}

export function joinTemplateSections(...sections: string[]): string {
  return `${sections.map((section) => section.trim()).join("\n\n")}\n`;
}

export async function ensureSiteTemplateFile(): Promise<string> {
  return initializeSiteTemplateFile({ overwrite: false });
}

export async function initializeSiteTemplateFile(options: {
  overwrite: boolean;
}): Promise<string> {
  const templatePath = getSiteTemplatePath();
  const template = await readBundledDefaultSiteTemplate();

  if (options.overwrite) {
    await mkdir(getSitesDirectoryPath(), { recursive: true });
    await writeFile(templatePath, template, "utf8");
    return templatePath;
  }

  try {
    await access(templatePath);
    return templatePath;
  } catch {
    await mkdir(getSitesDirectoryPath(), { recursive: true });
    await writeFile(templatePath, template, "utf8");
    return templatePath;
  }
}
