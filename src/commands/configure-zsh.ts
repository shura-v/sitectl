import { outro } from "@clack/prompts";
import { ensureDefaultDataFile, readDataText } from "../assets.js";
import { resolveServer } from "./server-target.js";
import { runRemoteScript } from "./run-remote-script.js";

export async function runConfigureZshCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  await ensureDefaultDataFile("remote/configure-zsh.sh", "remote/configure-zsh.sh");
  await ensureDefaultDataFile("remote/myzshrc.zsh", "remote/myzshrc.zsh");
  const scriptTemplate = await readDataText("remote/configure-zsh.sh");
  const myzshrcTemplate = await readDataText("remote/myzshrc.zsh");
  const myzshrcContent = myzshrcTemplate.replace(
    "__SITECTL_SERVER_FLAG__",
    toShellSingleQuoted(normalizeServerFlag(server.flag))
  );
  const script = scriptTemplate.replace(
    "__SITECTL_MYZSHRC_CONTENT__",
    myzshrcContent.trimEnd()
  );

  await runRemoteScript(server, script);
  outro(`Zsh configuration applied on "${name}".`);
}

function normalizeServerFlag(value: string): string {
  const normalized = value.replace(/\r?\n+/g, " ").trim();
  return normalized.length > 0 ? normalized : "🌍";
}

function toShellSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
