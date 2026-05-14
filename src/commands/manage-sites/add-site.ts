import { outro } from "@clack/prompts";
import { ensureDefaultDataFile } from "../../assets.js";
import { promptText } from "../../cli.js";
import { createSiteDirectory, seedSiteConfig } from "../../sites.js";

export async function runAddSiteAction(): Promise<void> {
  const siteName = await promptText({
    message: "Site name",
    placeholder: "example.com",
    validate: (value) => {
      if (value.length === 0) {
        return "Site name is required.";
      }

      if (value === "." || value === "..") {
        return "Site name must not be '.' or '..'.";
      }

      if (value.includes("/")) {
        return "Site name must not contain '/'.";
      }

      return undefined;
    }
  });
  const siteDirectoryPath = await createSiteDirectory(siteName);
  await ensureDefaultDataFile("nginx/bootstrap.conf", "nginx/bootstrap.conf");
  const siteConfigPath = await seedSiteConfig(siteName);

  outro(`Site created: ${siteDirectoryPath} and ${siteConfigPath}.`);
}
