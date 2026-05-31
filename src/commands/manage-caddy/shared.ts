import { getCaddySitesDirectoryPath, listCaddySites } from "../../caddy.js";
import { promptSelect } from "../../cli.js";
import { resolveServer } from "../utils/server-target.js";

export type ResolvedCaddySiteServer = {
  siteName: string;
  serverName: string;
  server: Awaited<ReturnType<typeof resolveServer>>["server"];
};

export async function chooseCaddySiteAndServer(): Promise<ResolvedCaddySiteServer> {
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
  const { name: serverName, server } = await resolveServer();

  return {
    siteName,
    serverName,
    server
  };
}

export function formatCaddySiteLabel(siteName: string, note: string | null): string {
  return note ? `${siteName} (${note})` : siteName;
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
