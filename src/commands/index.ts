import { cancel, outro } from "@clack/prompts";
import type { SelectOption } from "../cli.js";
import { promptSelect } from "../cli.js";
import { getConfigPath } from "../config.js";
import { runAddServerCommand } from "./add-server.js";
import { runConfigureZshCommand } from "./configure-zsh.js";
import { runDeleteServerCommand } from "./delete-server.js";
import { runEditServerCommand } from "./edit-server.js";
import { runInstallBasePackagesCommand } from "./install-base-packages.js";
import { runManageSitesCommand } from "./manage-sites.js";
import { runOpenDataDirCommand } from "./open-data-dir.js";
import { runSetupUfwCommand } from "./setup-ufw.js";

type CommandId =
  | "manage-servers"
  | "open-data-dir"
  | "manage-sites"
  | "exit";

type ServerCommandId =
  | "add-server"
  | "edit-server"
  | "delete-server"
  | "install-base-packages"
  | "configure-zsh"
  | "setup-ufw"
  | "back";

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
    id: "open-data-dir",
    label: "Open data dir",
    hint: "Open ~/.config/sitectl in the system file manager",
    run: runOpenDataDirCommand
  }
];

const serverCommandDefinitions: Array<{
  id: Exclude<ServerCommandId, "back">;
  label: string;
  hint: string;
  run: () => Promise<void>;
}> = [
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
  while (true) {
    const selected = await promptSelect(
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
      cancel(error instanceof Error ? error.message : "Unknown error.");
    }
  }
}

async function runManageServersFlow(): Promise<void> {
  while (true) {
    const selected = await promptSelect(
      [
        ...serverCommandDefinitions.map<SelectOption<ServerCommandId>>((command) => ({
          value: command.id,
          label: command.label,
          hint: command.hint
        })),
        {
          value: "back",
          label: "Back",
          hint: "Return to the main menu"
        }
      ],
      "Manage servers"
    );

    if (selected === "back") {
      return;
    }

    const command = serverCommandDefinitions.find(
      (definition) => definition.id === selected
    );

    if (!command) {
      throw new Error(`Unknown command: ${selected}`);
    }

    try {
      await command.run();
    } catch (error) {
      cancel(error instanceof Error ? error.message : "Unknown error.");
    }
  }
}
