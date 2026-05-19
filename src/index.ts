#!/usr/bin/env node

import { createRequire } from "node:module";
import { intro } from "@clack/prompts";
import { hasDataDirectory } from "./assets.js";
import { FriendlyMessageError, cancelWithMessage, failAndExit } from "./cli.js";
import { runInitCommand } from "./commands/init.js";
import { runCommandFlow } from "./commands/index.js";
import {
  buildRemoteCommandResolutionError,
  discoverRemoteMenuEntries,
  findRemoteMenuEntryByFilePathSegments,
  formatRunnableRemoteCommandList,
  resolveRemoteMenuEntryByFilePathSegments,
  runRemoteCommandByFilePathSegments
} from "./commands/remote-commands.js";
import { runSshCopyIdCommand } from "./commands/ssh-copy-id.js";
import { runSshCommand } from "./commands/ssh.js";
import { readConfig } from "./config.js";

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

  if (isRunInvocation(args)) {
    if (!(await hasDataDirectory())) {
      cancelWithMessage('Data directory is not initialized. Run "sitectl init" first.');
    }

    await runRemoteCommandCli(args.slice(1));
    return;
  }

  if (!(await hasDataDirectory())) {
    cancelWithMessage('Data directory is not initialized. Run "sitectl init" first.');
  }

  intro(`sitectl v${version}`);

  if (args.length > 0) {
    cancelWithMessage(
      'Unknown command. Use "sitectl init [--overwrite-bundled]", "sitectl ssh [server-name] [command-string]", "sitectl ssh-copy-id", "sitectl run <command> <server_name>" or run without arguments.'
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

function isRunInvocation(args: string[]): args is ["run", ...string[]] {
  return args.length >= 1 && args[0] === "run";
}

function isInitInvocation(args: string[]): args is ["init"] | ["init", "--overwrite-bundled"] {
  return (
    (args.length === 1 && args[0] === "init") ||
    (args.length === 2 && args[0] === "init" && args[1] === "--overwrite-bundled")
  );
}

async function runRemoteCommandCli(args: string[]): Promise<void> {
  const entries = await discoverRemoteMenuEntries();

  if (args.length === 0) {
    throw new FriendlyMessageError(
      ['Use "sitectl run <command> <server_name>".', "Available commands:", formatRunnableRemoteCommandList(entries)].join(
        "\n"
      )
    );
  }

  if (args.length === 1) {
    const commandPath = args[0];

    if (!commandPath) {
      throw new FriendlyMessageError(
        ['Use "sitectl run <command> <server_name>".', "Available servers:", await formatServerList()].join(
          "\n"
        )
      );
    }

    const pathSegments = commandPath.split("/").filter((segment) => segment.length > 0);
    const resolution = resolveRemoteMenuEntryByFilePathSegments(entries, pathSegments);

    if (resolution.entry?.kind === "submenu") {
      throw new FriendlyMessageError(buildRemoteCommandResolutionError(pathSegments, resolution));
    }

    if (resolution.entry?.kind === "command") {
      throw new FriendlyMessageError(
        ['Use "sitectl run <command> <server_name>".', "Available servers:", await formatServerList()].join(
          "\n"
        )
      );
    }

    throw new FriendlyMessageError(
      ['Use "sitectl run <command> <server_name>".', "Available commands:", formatRunnableRemoteCommandList(entries)].join(
        "\n"
      )
    );
  }

  if (args.length !== 2) {
    throw new FriendlyMessageError('Use "sitectl run <command> <server_name>".');
  }

  const commandPath = args[0];
  const serverName = args[1];

  if (!commandPath || !serverName) {
    throw new FriendlyMessageError('Use "sitectl run <command> <server_name>".');
  }

  const pathSegments = commandPath.split("/").filter((segment) => segment.length > 0);
  const commandEntry = findRemoteMenuEntryByFilePathSegments(entries, pathSegments);

  if (!commandEntry || commandEntry.kind !== "command") {
    throw new FriendlyMessageError(
      [
        `Unknown remote command: ${commandPath}.`,
        "Available commands:",
        formatRunnableRemoteCommandList(entries)
      ].join("\n")
    );
  }

  const config = await readConfig();

  if (!config.servers[serverName]) {
    throw new FriendlyMessageError(
      [`Unknown server: ${serverName}.`, "Available servers:", await formatServerList(config)].join("\n")
    );
  }

  await runRemoteCommandByFilePathSegments(pathSegments, serverName);
}

async function formatServerList(config?: Awaited<ReturnType<typeof readConfig>>): Promise<string> {
  const resolvedConfig = config ?? (await readConfig());
  const names = Object.keys(resolvedConfig.servers).sort((left, right) => left.localeCompare(right));

  if (names.length === 0) {
    return "(empty)";
  }

  return names
    .map((name) => {
      const server = resolvedConfig.servers[name]!;
      return `- ${name}: ${server.user}@${server.address}:${server.port}`;
    })
    .join("\n");
}

void main().catch((error: unknown) => {
  failAndExit(error);
});
