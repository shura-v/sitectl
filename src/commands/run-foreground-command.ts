import { spawn } from "node:child_process";

export async function runForegroundCommand(
  command: string,
  args: string[]
): Promise<void> {
  const child = spawn(command, args, {
    stdio: "inherit"
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
    process.kill(process.pid, result.signal);
    return;
  }

  if (result.code && result.code !== 0) {
    process.exitCode = result.code;
  }
}
