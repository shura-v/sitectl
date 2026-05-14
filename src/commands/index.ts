import type { SelectOption } from "../cli.js";
import { promptSelect } from "../cli.js";
import { getConfigPath } from "../config.js";
import { runAddServerCommand } from "./add-server.js";
import { runConfigureZshCommand } from "./configure-zsh.js";
import { runDeleteServerCommand } from "./delete-server.js";
import { runEditServerCommand } from "./edit-server.js";
import { runInstallBasePackagesCommand } from "./install-base-packages.js";
import { runSetupUfwCommand } from "./setup-ufw.js";

type CommandId =
  | "add-server"
  | "edit-server"
  | "delete-server"
  | "install-base-packages"
  | "configure-zsh"
  | "setup-ufw";

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
  },
  {
    id: "install-base-packages",
    label: "Install base packages",
    hint: "Run the base apt/bootstrap script on a server",
    run: runInstallBasePackagesCommand
  },
  {
    id: "configure-zsh",
    label: "Configure zsh",
    hint: "Create ~/.myzshrc and wire it into ~/.zshrc",
    run: runConfigureZshCommand
  },
  {
    id: "setup-ufw",
    label: "Setup ufw",
    hint: "Allow SSH, 80/tcp and 443/tcp, then enable ufw",
    run: runSetupUfwCommand
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
