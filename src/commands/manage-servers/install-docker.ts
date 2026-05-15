import { outro } from "@clack/prompts";
import { spawn } from "node:child_process";
import { ensureDefaultDataFile, readDataText } from "../../assets.js";
import { promptConfirm } from "../../cli.js";
import { runRemoteScript } from "../utils/run-remote-script.js";
import { formatServerSshTarget, resolveServer } from "../utils/server-target.js";

export async function runInstallDockerCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  const dockerState = await readRemoteDockerState(server);

  if (
    dockerState.isInstalled ||
    dockerState.runningContainerCount > 0 ||
    dockerState.conflictingPackages.length > 0
  ) {
    const details: string[] = [];

    if (dockerState.isInstalled) {
      details.push("Docker already appears to be installed");
    }

    if (dockerState.runningContainerCount > 0) {
      details.push(
        `${dockerState.runningContainerCount} container${dockerState.runningContainerCount === 1 ? "" : "s"} currently running`
      );
    }

    if (dockerState.conflictingPackages.length > 0) {
      details.push(
        `conflicting packages installed: ${dockerState.conflictingPackages.join(", ")}`
      );
    }

    const approved = await promptConfirm(
      `Docker on "${name}" may already be in use: ${details.join("; ")}. Continue with Docker installation anyway?`
    );

    if (!approved) {
      return;
    }
  }

  await ensureDefaultDataFile("remote/docker/install-docker.sh", "remote/docker/install-docker.sh");
  const script = await readDataText("remote/docker/install-docker.sh");

  await runRemoteScript(server, script);
  outro(`Docker installed on "${name}".`);
}

async function readRemoteDockerState(
  server: Parameters<typeof runRemoteScript>[0]
): Promise<{
  conflictingPackages: string[];
  isInstalled: boolean;
  runningContainerCount: number;
}> {
  const output = await runCommandCaptureStdout("ssh", [
    "-p",
    String(server.port),
    formatServerSshTarget(server),
    [
      "conflicts='';",
      "for pkg in docker.io docker-compose docker-compose-v2 docker-doc podman-docker containerd runc; do",
      "  if dpkg -s \"$pkg\" >/dev/null 2>&1; then",
      "    conflicts=\"${conflicts}${conflicts:+,}$pkg\";",
      "  fi;",
      "done;",
      "printf 'conflicts=%s\\n' \"$conflicts\";",
      "if command -v docker >/dev/null 2>&1; then",
      "  printf 'installed=yes\\n';",
      "  printf 'running=%s\\n' \"$(docker ps -q 2>/dev/null | wc -l)\";",
      "else",
      "  printf 'installed=no\\n';",
      "  printf 'running=0\\n';",
      "fi"
    ].join(" ")
  ]);
  const lines = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const conflictsLine = lines.find((line) => line.startsWith("conflicts="));
  const installedLine = lines.find((line) => line.startsWith("installed="));
  const runningLine = lines.find((line) => line.startsWith("running="));
  const runningValue = runningLine ? Number.parseInt(runningLine.slice("running=".length), 10) : 0;
  const conflictingPackages = conflictsLine
    ? conflictsLine
        .slice("conflicts=".length)
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  return {
    conflictingPackages,
    isInstalled: installedLine === "installed=yes",
    runningContainerCount: Number.isFinite(runningValue) ? runningValue : 0
  };
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
