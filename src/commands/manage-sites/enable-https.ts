import { chooseSiteAndServer, enableRemoteSiteConfig } from "./shared.js";

export async function runEnableHttpsAction(): Promise<void> {
  const { siteName, serverName, server } = await chooseSiteAndServer();
  await enableRemoteSiteConfig({
    siteName,
    serverName,
    server,
    sourceFileName: `${siteName}.conf`,
    targetFileName: `${siteName}.conf`,
    successLabel: "HTTPS config"
  });
}
