import { note, outro } from "@clack/prompts";
import { promptConfirm } from "../../cli.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import {
  chooseSiteAndServer,
  enableRemoteSiteConfig,
  readRemoteSymlinkTarget,
  remoteFindCertificateLineage,
  restoreRemoteSiteConfig,
  shellQuote,
  syncSiteHttpsConfigToServer,
  updateLocalSiteConfigLineage
} from "./shared.js";

export async function runIssueCertificateAction(): Promise<void> {
  const { siteName, serverName, server } = await chooseSiteAndServer();
  const targetFileName = `${siteName}.conf`;
  const previousTarget = await readRemoteSymlinkTarget(server, targetFileName);
  const bootstrapTarget = `/etc/nginx/sites-available/${siteName}.bootstrap.conf`;
  const existingLineage = await remoteFindCertificateLineage(server, siteName);

  if (existingLineage) {
    note(
      `Certbot already knows a certificate for "${siteName}" as "${existingLineage}".`,
      "Existing certificate"
    );

    const approved = await promptConfirm(
      `Run certificate issuance again for "${siteName}" on "${serverName}"?`
    );

    if (!approved) {
      await updateLocalSiteConfigLineage(siteName, existingLineage);
      await syncSiteHttpsConfigToServer(siteName, server);
      outro(`Certificate issuance skipped. HTTPS config for "${siteName}" synced to "${serverName}".`);
      return;
    }
  }

  await enableRemoteSiteConfig({
    siteName,
    serverName,
    server,
    sourceFileName: `${siteName}.bootstrap.conf`,
    targetFileName,
    successLabel: "HTTP bootstrap config"
  });

  const deployTarget = `${server.user}@${server.address}`;
  const quotedSiteName = shellQuote(siteName);
  const remoteCommand =
    server.user === "root"
      ? `certbot certonly --nginx -d ${quotedSiteName}`
      : `sudo certbot certonly --nginx -d ${quotedSiteName}`;

  try {
    await runForegroundCommand(
      "ssh",
      ["-p", String(server.port), deployTarget, remoteCommand],
      { throwOnNonZero: true }
    );
  } catch (error) {
    await restoreRemoteSiteConfig(server, targetFileName, previousTarget);
    throw error;
  }

  if (previousTarget.length > 0 && previousTarget !== bootstrapTarget) {
    await restoreRemoteSiteConfig(server, targetFileName, previousTarget);
  }

  const lineage = await remoteFindCertificateLineage(server, siteName);

  if (!lineage) {
    throw new Error(`Could not determine the Certbot lineage for "${siteName}".`);
  }

  await updateLocalSiteConfigLineage(siteName, lineage);
  await syncSiteHttpsConfigToServer(siteName, server);

  outro(`Certificate issued for "${siteName}" on "${serverName}".`);
}
