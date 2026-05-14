#!/usr/bin/env node

import { intro } from "@clack/prompts";
import { cancelWithMessage, failAndExit } from "./cli.js";
import { runCommandFlow } from "./commands/index.js";

const version = "0.1.0";

async function main(): Promise<void> {
  intro(`sitectl v${version}`);
  const args = process.argv.slice(2);

  if (args.length > 0) {
    cancelWithMessage(
      "This CLI only works in interactive mode. Run it without arguments."
    );
  }

  await runCommandFlow();
}

void main().catch((error: unknown) => {
  failAndExit(error);
});
