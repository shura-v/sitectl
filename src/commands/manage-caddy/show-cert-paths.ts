import { note, outro } from "@clack/prompts";
import { resolveServer } from "../utils/server-target.js";
import { listRemoteCaddyCertificatePaths } from "./shared.js";

export async function runShowCaddyCertPathsAction(): Promise<void> {
  const { name: serverName, server } = await resolveServer();
  const paths = await listRemoteCaddyCertificatePaths(server);

  if (paths.length === 0) {
    note(`No Caddy certificate files were found on "${serverName}".`, "Missing certs");
    return;
  }

  note(paths.join("\n"), `Cert paths on ${serverName}`);
  outro(`Caddy certificate paths shown for "${serverName}".`);
}
