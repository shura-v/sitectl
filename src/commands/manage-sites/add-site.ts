import { outro } from "@clack/prompts";
import { promptText } from "../../cli.js";
import { detectHostKind, normalizeHostValue } from "../../hosts.js";
import { createSiteDirectory, seedSiteConfig, writeSiteNote } from "../../sites.js";

export async function runAddSiteAction(): Promise<void> {
  const siteHostInput = await promptText({
    message: "Site host (domain or IP address)",
    placeholder: "example.com",
    validate: (value) => {
      if (value.length === 0) {
        return "Host is required.";
      }

      if (value === "." || value === "..") {
        return "Host must not be '.' or '..'.";
      }

      if (value.includes("/")) {
        return "Host must not contain '/'.";
      }

      if (/\s/.test(value)) {
        return "Host must not contain whitespace.";
      }

      return undefined;
    }
  });
  const siteName = normalizeHostValue(siteHostInput);
  const siteNote = await promptText({
    message: "Site note (optional)",
    placeholder: "Customer site, staging API, demo IPv6 host..."
  });
  const siteDirectoryPath = await createSiteDirectory(siteName);
  const siteConfigPath = await seedSiteConfig(siteName);

  if (siteNote.trim().length > 0) {
    await writeSiteNote(siteName, siteNote);
  }

  const hostKind = detectHostKind(siteName);

  outro(
    `Site created for ${hostKind === "domain" ? "domain" : "IP host"} "${siteName}": ${siteDirectoryPath} and ${siteConfigPath}.`
  );
}
