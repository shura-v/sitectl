#!/usr/bin/env node

import { createRequire } from "node:module";
import { intro } from "@clack/prompts";
import { hasDataDirectory } from "./assets.js";
import { cancelWithMessage, failAndExit } from "./cli.js";
import { runInitCommand } from "./commands/init.js";
import { runCommandFlow } from "./commands/index.js";
import { runSshCopyIdCommand } from "./commands/ssh-copy-id.js";
import { runSshCommand } from "./commands/ssh.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (isInitInvocation(args)) {
    await runInitCommand({ overwrite: args.length === 2 });
    return;
  }

  if (isSshInvocation(args)) {
    await runSshCommand(args[1], args[2]);
    return;
  }

  if (isSshCopyIdInvocation(args)) {
    await runSshCopyIdCommand();
    return;
  }

  if (!(await hasDataDirectory())) {
    cancelWithMessage('Data directory is not initialized. Run "sitectl init" first.');
  }

  intro(`sitectl v${version}`);

  if (args.length > 0) {
    cancelWithMessage(
      'Unknown command. Use "sitectl init [--overwrite-bundled]", "sitectl ssh [server-name] [command-string]", "sitectl ssh-copy-id" or run without arguments.'
    );
  }

  await runCommandFlow();
}

function isSshInvocation(args: string[]): args is ["ssh"] | ["ssh", string] | ["ssh", string, string] {
  return (args.length === 1 || args.length === 2 || args.length === 3) && args[0] === "ssh";
}

function isSshCopyIdInvocation(args: string[]): args is ["ssh-copy-id"] {
  return args.length === 1 && args[0] === "ssh-copy-id";
}

function isInitInvocation(args: string[]): args is ["init"] | ["init", "--overwrite-bundled"] {
  return (
    (args.length === 1 && args[0] === "init") ||
    (args.length === 2 && args[0] === "init" && args[1] === "--overwrite-bundled")
  );
}

void main().catch((error: unknown) => {
  failAndExit(error);
});
