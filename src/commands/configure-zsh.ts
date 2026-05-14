import { outro } from "@clack/prompts";
import { readAssetText } from "../assets.js";
import { resolveServer } from "./server-target.js";
import { runRemoteScript } from "./run-remote-script.js";

export async function runConfigureZshCommand(): Promise<void> {
  const { name, server } = await resolveServer();
  const scriptTemplate = await readAssetText("remote/configure-zsh.sh");
  const myzshrcTemplate = await readAssetText("remote/myzshrc.zsh");
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
