import { spawn } from "node:child_process";
import { getCaddySitesDirectoryPath, listCaddySites } from "../../caddy.js";
import { promptSelect } from "../../cli.js";
import { formatServerSshTarget, resolveServer } from "../utils/server-target.js";

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

export async function runCommandCaptureStdout(
  command: string,
  args: string[]
): Promise<string> {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "inherit"]
  });

  const stdoutChunks: Buffer[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutChunks.push(chunk);
  });

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => {
        resolve({ code, signal });
      });
    }
  );

  if (result.signal) {
    throw new Error(`${command} was terminated by signal ${result.signal}.`);
  }

  if (result.code && result.code !== 0) {
    throw new Error(`${command} failed with exit code ${result.code}.`);
  }

  return Buffer.concat(stdoutChunks).toString("utf8").trim();
}

export async function listRemoteCaddyCertificatePaths(
  server: Awaited<ReturnType<typeof resolveServer>>["server"]
): Promise<string[]> {
  const deployTarget = formatServerSshTarget(server);
  const certificateRoot = "/var/lib/caddy/.local/share/caddy/certificates";
  const findCommand = [
    `if [ ! -d ${shellQuote(certificateRoot)} ]; then`,
    "  exit 0",
    "fi",
    `find ${shellQuote(certificateRoot)} -type f \\( -name '*.crt' -o -name '*.key' \\) | sort`
  ].join("\n");
  const command =
    server.user === "root"
      ? findCommand
      : `sudo sh -c ${shellQuote(findCommand)}`;
  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    deployTarget,
    command
  ]);

  return output.length === 0 ? [] : output.split("\n").filter(Boolean);
}
