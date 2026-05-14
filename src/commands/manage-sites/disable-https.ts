import { chooseSiteAndServer, enableRemoteSiteConfig } from "./shared.js";

export async function runDisableHttpsAction(): Promise<void> {
  const { siteName, serverName, server } = await chooseSiteAndServer();
  await enableRemoteSiteConfig({
    siteName,
    serverName,
    server,
    sourceFileName: `${siteName}.bootstrap.conf`,
    targetFileName: `${siteName}.conf`,
    successLabel: "HTTPS disabled; HTTP bootstrap config"
  });
}
