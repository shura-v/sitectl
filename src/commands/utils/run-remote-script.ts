import { spawn } from "node:child_process";
import type { ServerConfig } from "../../config.js";
import { formatServerSshTarget } from "./server-target.js";

export async function runRemoteScript(
  server: ServerConfig,
  script: string,
  options?: {
    env?: Record<string, string>;
  }
): Promise<void> {
  const sshArgs = [
    "-p",
    String(server.port),
    formatServerSshTarget(server),
    "bash",
    "-s"
  ];
  const child = spawn("ssh", sshArgs, {
    stdio: ["pipe", "inherit", "inherit"]
  });

  child.stdin.write(buildRemoteScriptInput(script, options?.env));
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

function buildRemoteScriptInput(
  script: string,
  env?: Record<string, string>
): string {
  if (!env || Object.keys(env).length === 0) {
    return script;
  }

  const exports = Object.entries(env)
    .map(([key, value]) => `export ${key}=${shellSingleQuote(value)}`)
    .join("\n");

  return `${exports}\n${script}`;
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
