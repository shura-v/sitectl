import type { SelectOption } from "../cli.js";
import { promptSelect } from "../cli.js";
import { getConfigPath } from "../config.js";
import { runAddServerCommand } from "./add-server.js";
import { runDeleteServerCommand } from "./delete-server.js";
import { runEditServerCommand } from "./edit-server.js";

type CommandId = "add-server" | "edit-server" | "delete-server";

type CommandDefinition = {
  id: CommandId;
  label: string;
  hint: string;
  run: () => Promise<void>;
};

const commandDefinitions: CommandDefinition[] = [
  {
    id: "add-server",
    label: "Add server",
    hint: "Create a new server record",
    run: runAddServerCommand
  },
  {
    id: "edit-server",
    label: "Edit server",
    hint: "Update an existing server record",
    run: runEditServerCommand
  },
  {
    id: "delete-server",
    label: "Delete server",
    hint: "Remove a saved server record",
    run: runDeleteServerCommand
  }
];

export async function runCommandFlow(): Promise<void> {
  const selected = await promptSelect(
    commandDefinitions.map<SelectOption<CommandId>>((command) => ({
      value: command.id,
      label: command.label,
      hint: command.hint
    })),
    `Choose an action (${getConfigPath()})`
  );
  const command = commandDefinitions.find((definition) => definition.id === selected);

  if (!command) {
    throw new Error(`Unknown command: ${selected}`);
  }

  await command.run();
}
