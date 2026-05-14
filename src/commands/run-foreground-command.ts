import { spawn } from "node:child_process";

export async function runForegroundCommand(
  command: string,
  args: string[],
  options: {
    throwOnNonZero?: boolean;
  } = {}
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
    if (options.throwOnNonZero) {
      throw new Error(`${command} was terminated by signal ${result.signal}.`);
    }

    process.kill(process.pid, result.signal);
    return;
  }

  if (result.code && result.code !== 0) {
    if (options.throwOnNonZero) {
      throw new Error(`${command} failed with exit code ${result.code}.`);
    }

    process.exitCode = result.code;
  }
}
