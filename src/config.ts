import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type ServerConfig = {
  address: string;
  port: number;
  user: string;
};

export type SitectlConfig = {
  servers: Record<string, ServerConfig>;
};

const defaultConfig: SitectlConfig = {
  servers: {}
};

export function getConfigPath(): string {
  return join(homedir(), ".config", "sitectl", "config.json");
}

export async function readConfig(): Promise<SitectlConfig> {
  const configPath = getConfigPath();

  try {
    const contents = await readFile(configPath, "utf8");
    const parsed = JSON.parse(contents) as Partial<SitectlConfig>;

    return {
      servers: parsed.servers ?? {}
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return structuredClone(defaultConfig);
    }

    throw error;
  }
}

export async function writeConfig(config: SitectlConfig): Promise<void> {
  const configPath = getConfigPath();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  );
}
