import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type ServerConfig = {
  address: string;
  flag: string;
  port: number;
  user: string;
};

export type SitectlConfig = {
  servers: Record<string, ServerConfig>;
};

const defaultConfig: SitectlConfig = {
  servers: {}
};

export function getDataDirectoryPath(): string {
  return join(homedir(), ".config", "sitectl");
}

export function getConfigPath(): string {
  return join(getDataDirectoryPath(), "config.json");
}

export async function readConfig(): Promise<SitectlConfig> {
  const configPath = getConfigPath();

  try {
    const contents = await readFile(configPath, "utf8");
    const parsed = JSON.parse(contents) as Partial<SitectlConfig>;
    const servers = Object.fromEntries(
      Object.entries(parsed.servers ?? {}).map(([name, server]) => [
        name,
        {
          address: server.address ?? "",
          flag: server.flag ?? "🌍",
          port: server.port ?? 22,
          user: server.user ?? "root"
        }
      ])
    );

    return {
      servers
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

export async function ensureConfigFile(): Promise<string> {
  const configPath = getConfigPath();

  try {
    await readFile(configPath, "utf8");
    return configPath;
  } catch (error) {
    if (!isMissingFileError(error)) {
      throw error;
    }
  }

  await writeConfig(structuredClone(defaultConfig));
  return configPath;
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
  );
}
