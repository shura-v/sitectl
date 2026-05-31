import { outro } from "@clack/prompts";
import { promptText } from "../../cli.js";
import { createCaddySiteDirectory, seedCaddySiteConfig, writeCaddySiteNote } from "../../caddy.js";
import { detectHostKind, normalizeHostValue } from "../../hosts.js";

export async function runAddCaddySiteAction(): Promise<void> {
  const siteHostInput = await promptText({
    message: "Site host (domain only)",
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

      if (detectHostKind(value) !== "domain") {
        return "Manage caddy currently supports public domains only.";
      }

      return undefined;
    }
  });
  const siteName = normalizeHostValue(siteHostInput);
  const siteNote = await promptText({
    message: "Site note (optional)",
    placeholder: "Customer site, landing page, docs..."
  });
  const siteDirectoryPath = await createCaddySiteDirectory(siteName);
  const siteConfigPath = await seedCaddySiteConfig(siteName);

  if (siteNote.trim().length > 0) {
    await writeCaddySiteNote(siteName, siteNote);
  }

  outro(`Caddy site created for domain "${siteName}": ${siteDirectoryPath} and ${siteConfigPath}.`);
}
