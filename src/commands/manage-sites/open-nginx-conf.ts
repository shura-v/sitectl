import { note, outro } from "@clack/prompts";
import { join } from "node:path";
import { getDataPath } from "../../assets.js";
import { promptSelect } from "../../cli.js";
import { getSitesDirectoryPath, hasSiteConfig, listSiteNames } from "../../sites.js";
import { openLocalPath } from "../utils/open-local-path.js";

export async function runOpenNginxConfAction(): Promise<void> {
  const siteNames = await listSiteNames();

  if (siteNames.length === 0) {
    throw new Error(`No site folders found in ${getSitesDirectoryPath()}.`);
  }

  const siteName = await promptSelect(
    siteNames.map((name) => ({
      value: name,
      label: name
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
