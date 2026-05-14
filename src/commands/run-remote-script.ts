import { spawn } from "node:child_process";
import type { ServerConfig } from "../config.js";

export async function runRemoteScript(
  server: ServerConfig,
  script: string
): Promise<void> {
  const sshArgs = [
    "-p",
    String(server.port),
    `${server.user}@${server.address}`,
    "bash",
    "-s"
  ];
  const child = spawn("ssh", sshArgs, {
    stdio: ["pipe", "inherit", "inherit"]
  });

  child.stdin.write(script);
  child.stdin.end();

  const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code, signal) => {
        resolve({ code, signal });
      });
    }
  );

  if (result.signal) {
    throw new Error(`Remote script was terminated by signal ${result.signal}.`);
  }

  if (result.code && result.code !== 0) {
    throw new Error(`Remote script failed with exit code ${result.code}.`);
  }
}
