import { note, outro } from "@clack/prompts";
import { join } from "node:path";
import { getDataPath } from "../../assets.js";
import { hasCaddySiteConfig, getCaddySitesDirectoryPath, listCaddySites } from "../../caddy.js";
import { promptSelect } from "../../cli.js";
import { openLocalPath } from "../utils/open-local-path.js";
import { formatCaddySiteLabel } from "./shared.js";

export async function runOpenCaddyfileAction(): Promise<void> {
  const sites = await listCaddySites();

  if (sites.length === 0) {
    throw new Error(`No Caddy site folders found in ${getCaddySitesDirectoryPath()}.`);
  }

  const siteName = await promptSelect(
    sites.map((site) => ({
      value: site.name,
      label: formatCaddySiteLabel(site.name, site.note)
    })),
    "Choose a site"
  );

  if (!(await hasCaddySiteConfig(siteName))) {
    note(
      `Missing ${join(getCaddySitesDirectoryPath(), siteName, "Caddyfile")}.`,
      "Missing config"
    );
    return;
  }

  const siteConfigPath = getDataPath(`caddy/sites/${siteName}/Caddyfile`);

  await openLocalPath(siteConfigPath);
  outro(`Opened ${siteConfigPath}.`);
}
