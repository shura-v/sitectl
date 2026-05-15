import { note, outro } from "@clack/prompts";
import { spawn } from "node:child_process";
import { ensureDefaultDataFile, readDataText } from "../../assets.js";
import { promptConfirm } from "../../cli.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { formatServerSshTarget, resolveServer } from "../utils/server-target.js";

export async function runUninstallDockerCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  const runningContainers = await readRemoteRunningContainers(server);

  if (runningContainers.length > 0) {
    note(runningContainers.join("\n"), `Running containers on "${name}"`);
  }

  const approved = await promptConfirm(
    `Uninstall Docker on "${name}" and permanently delete all Docker containers, images, networks, and volumes?`
  );

  if (!approved) {
    outro("Docker uninstall cancelled.");
    return;
  }

  await ensureDefaultDataFile(
    "remote/docker/uninstall-docker.sh",
    "remote/docker/uninstall-docker.sh"
  );
  const script = await readDataText("remote/docker/uninstall-docker.sh");

  await runRemoteScript(server, script);
  outro(`Docker uninstalled on "${name}".`);
}

async function readRemoteRunningContainers(
  server: Parameters<typeof runRemoteScript>[0]
): Promise<string[]> {
  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    formatServerSshTarget(server),
    [
      "if command -v docker >/dev/null 2>&1; then",
      "  docker ps --format '{{.Names}}\\t{{.Image}}' 2>/dev/null || true;",
      "fi"
    ].join(" ")
  ]);

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function runCommandCaptureStdout(command: string, args: string[]): Promise<string> {
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
