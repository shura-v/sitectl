import { outro } from "@clack/prompts";
import { promptConfirm } from "../../cli.js";
import { runForegroundCommand } from "../utils/run-foreground-command.js";
import { formatServerSshTarget } from "../utils/server-target.js";
import {
  chooseSiteAndServer,
  resetLocalSiteConfigCertificatePaths,
  remoteFindCertificateLineageDetails,
  resolveRemoteCertbotExecutable,
  shellQuote
} from "./shared.js";

export async function runRemoveSiteFromServerAction(): Promise<void> {
  const { siteName, serverName, server } = await chooseSiteAndServer();
  const lineage = await remoteFindCertificateLineageDetails(server, siteName);
  const removableLineage =
    lineage && lineage.domains.length === 1 && lineage.domains[0] === siteName
      ? lineage.certificateName
      : null;
  const approved = await promptConfirm(
    removableLineage
      ? `Remove site "${siteName}" from "${serverName}" and delete certbot lineage "${removableLineage}"?`
      : `Remove site "${siteName}" from "${serverName}"?`
  );

  if (!approved) {
    outro("Removal cancelled.");
    return;
  }

  const deployTarget = formatServerSshTarget(server);
  const enabledPath = `/etc/nginx/sites-enabled/${siteName}.conf`;
  const httpsPath = `/etc/nginx/sites-available/${siteName}.conf`;
  const bootstrapPath = `/etc/nginx/sites-available/${siteName}.bootstrap.conf`;
  const sslIncludePath = `/etc/nginx/sitectl-includes/${siteName}.ssl.conf`;
  const nginxCleanupCommand =
    server.user === "root"
      ? [
          `rm -f ${shellQuote(enabledPath)}`,
          `rm -f ${shellQuote(httpsPath)}`,
          `rm -f ${shellQuote(bootstrapPath)}`,
          `rm -f ${shellQuote(sslIncludePath)}`,
          "nginx -t",
          "systemctl reload nginx"
        ].join(" && ")
      : [
          `sudo rm -f ${shellQuote(enabledPath)}`,
          `sudo rm -f ${shellQuote(httpsPath)}`,
          `sudo rm -f ${shellQuote(bootstrapPath)}`,
          `sudo rm -f ${shellQuote(sslIncludePath)}`,
          "sudo nginx -t",
          "sudo systemctl reload nginx"
        ].join(" && ");

  await runForegroundCommand(
    "ssh",
    ["-p", String(server.port), deployTarget, nginxCleanupCommand],
    { throwOnNonZero: true }
  );

  if (removableLineage) {
    const certbotExecutable = await resolveRemoteCertbotExecutable(server);

    if (!certbotExecutable) {
      throw new Error(`Could not determine which certbot executable to use on "${serverName}".`);
    }

    const deleteCertCommand =
      server.user === "root"
        ? `${shellQuote(certbotExecutable)} delete --cert-name ${shellQuote(removableLineage)} --non-interactive`
        : `sudo ${shellQuote(certbotExecutable)} delete --cert-name ${shellQuote(removableLineage)} --non-interactive`;

    await runForegroundCommand(
      "ssh",
      ["-p", String(server.port), deployTarget, deleteCertCommand],
      { throwOnNonZero: true }
    );
  }
  await resetLocalSiteConfigCertificatePaths(siteName);

  outro(
    removableLineage
      ? `Site "${siteName}" and certificate "${removableLineage}" removed from "${serverName}".`
      : lineage
        ? `Site "${siteName}" removed from "${serverName}". Shared or multi-domain certificate "${lineage.certificateName}" was kept.`
        : `Site "${siteName}" removed from "${serverName}".`
  );
}
