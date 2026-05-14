#!/usr/bin/env node

import { intro } from "@clack/prompts";
import { cancelWithMessage, failAndExit } from "./cli.js";
import { runCommandFlow } from "./commands/index.js";
import { runSshCopyIdCommand } from "./commands/ssh-copy-id.js";
import { runSshCommand } from "./commands/ssh.js";

const version = "0.1.0";

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (isSshInvocation(args)) {
    await runSshCommand(args[1]);
    return;
  }

  if (isSshCopyIdInvocation(args)) {
    await runSshCopyIdCommand();
    return;
  }

  intro(`sitectl v${version}`);

  if (args.length > 0) {
    cancelWithMessage(
      'Unknown command. Use "sitectl ssh [server-name]", "sitectl ssh-copy-id" or run without arguments.'
    );
  }

  await runCommandFlow();
}

function isSshInvocation(args: string[]): args is ["ssh", string] {
  return (args.length === 1 || args.length === 2) && args[0] === "ssh";
}

function isSshCopyIdInvocation(args: string[]): args is ["ssh-copy-id"] {
  return args.length === 1 && args[0] === "ssh-copy-id";
}

void main().catch((error: unknown) => {
  failAndExit(error);
});
