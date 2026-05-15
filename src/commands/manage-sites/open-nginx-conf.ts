import { note, outro } from "@clack/prompts";
import { join } from "node:path";
import { getDataPath } from "../../assets.js";
import { promptSelect } from "../../cli.js";
import { getSitesDirectoryPath, hasSiteConfig, listSites } from "../../sites.js";
import { openLocalPath } from "../utils/open-local-path.js";
import { formatSiteLabel } from "./shared.js";

export async function runOpenNginxConfAction(): Promise<void> {
  const sites = await listSites();

  if (sites.length === 0) {
    throw new Error(`No site folders found in ${getSitesDirectoryPath()}.`);
  }

  const siteName = await promptSelect(
    sites.map((site) => ({
      value: site.name,
      label: formatSiteLabel(site.name, site.note)
    })),
    "Choose a site"
  );

  if (!(await hasSiteConfig(siteName))) {
    note(
      `Missing ${join(getSitesDirectoryPath(), siteName, "nginx.conf")}.`,
      "Missing config"
    );
    return;
  }

  const siteConfigPath = getDataPath(`nginx/sites/${siteName}/nginx.conf`);

  await openLocalPath(siteConfigPath);
  outro(`Opened ${siteConfigPath}.`);
}
