import { cancel, outro } from "@clack/prompts";
import type { SelectOption } from "../cli.js";
import { isPromptCancelledError, promptSelect } from "../cli.js";
import { getConfigPath } from "../config.js";
import { runManageServersFlow } from "./manage-servers/index.js";
import { runRemoteCommandsFlow } from "./remote-commands.js";
import { runManageSitesCommand } from "./manage-sites/index.js";
import { runOpenDataDirCommand } from "./open-data-dir.js";

type CommandId =
  | "manage-servers"
  | "remote-commands"
  | "open-data-dir"
  | "manage-sites"
  | "exit";

type CommandDefinition = {
  id: CommandId;
  label: string;
  hint: string;
  run: () => Promise<void>;
};

const commandDefinitions: CommandDefinition[] = [
  {
    id: "manage-servers",
    label: "Manage servers",
    hint: "Add/edit/delete servers and run server-level setup actions",
    run: runManageServersFlow
  },
  {
    id: "manage-sites",
    label: "Manage sites",
    hint: "Add sites and copy bootstrap/http + https nginx configs",
    run: runManageSitesCommand
  },
  {
    id: "remote-commands",
    label: "Remote commands",
    hint: "Run server-side automation commands against a selected server",
    run: runRemoteCommandsFlow
  },
  {
    id: "open-data-dir",
    label: "Open data dir",
    hint: "Open ~/.config/sitectl in the system file manager",
    run: runOpenDataDirCommand
  }
];

export async function runCommandFlow(): Promise<void> {
  while (true) {
    let selected: CommandId;

    try {
      selected = await promptSelect(
        [
          ...commandDefinitions.map<SelectOption<CommandId>>((command) => ({
            value: command.id,
            label: command.label,
            hint: command.hint
          })),
          {
            value: "exit",
            label: "Exit",
            hint: "Close the interactive menu"
          }
        ],
        `Choose an action (${getConfigPath()})`
      );
    } catch (error) {
      if (isPromptCancelledError(error)) {
        outro("Bye.");
        return;
      }

      throw error;
    }

    if (selected === "exit") {
      outro("Bye.");
      return;
    }

    const command = commandDefinitions.find((definition) => definition.id === selected);

    if (!command) {
      throw new Error(`Unknown command: ${selected}`);
    }

    try {
      await command.run();
    } catch (error) {
      if (isPromptCancelledError(error)) {
        continue;
      }

      cancel(error instanceof Error ? error.message : "Unknown error.");
    }
  }
}
