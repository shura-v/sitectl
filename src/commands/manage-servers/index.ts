import { cancel } from "@clack/prompts";
import type { SelectOption } from "../../cli.js";
import { isPromptCancelledError, promptSelect } from "../../cli.js";
import { runAddServerCommand } from "./add-server.js";
import { runConfigureZshCommand } from "./configure-zsh.js";
import { runDeleteServerCommand } from "./delete-server.js";
import { runEditServerCommand } from "./edit-server.js";
import { runInstallBasePackagesCommand } from "./install-base-packages.js";
import { runInstallDockerCommand } from "./install-docker.js";
import { runSetupUfwCommand } from "./setup-ufw.js";
import { runUninstallDockerCommand } from "./uninstall-docker.js";
import { runSshCommand } from "../ssh.js";
import { runSshCopyIdCommand } from "../ssh-copy-id.js";

type ServerCommandId =
  | "add-server"
  | "edit-server"
  | "delete-server"
  | "ssh-copy-id"
  | "ssh"
  | "install-base-packages"
  | "docker"
  | "configure-zsh"
  | "setup-ufw"
  | "back";

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
    id: "ssh-copy-id",
    label: "SSH copy id",
    hint: "Install your SSH public key on a server",
    run: runSshCopyIdCommand
  },
  {
    id: "ssh",
    label: "SSH",
    hint: "Open an SSH session to a server",
    run: runSshCommand
  },
  {
    id: "install-base-packages",
    label: "Install base packages",
    hint: "Run the base apt/bootstrap script on a server",
    run: runInstallBasePackagesCommand
  },
  {
    id: "docker",
    label: "Docker",
    hint: "Install or uninstall Docker on a server",
    run: runManageServerDockerFlow
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

export async function runManageServersFlow(): Promise<void> {
  while (true) {
    let selected: ServerCommandId;

    try {
      selected = await promptSelect(
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
    } catch (error) {
      if (isPromptCancelledError(error)) {
        return;
      }

      throw error;
    }

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
      if (isPromptCancelledError(error)) {
        continue;
      }

      cancel(error instanceof Error ? error.message : "Unknown error.");
    }
  }
}

type DockerCommandId = "install-docker" | "uninstall-docker" | "back";

const dockerCommandDefinitions: Array<{
  id: Exclude<DockerCommandId, "back">;
  label: string;
  hint: string;
  run: () => Promise<void>;
}> = [
  {
    id: "install-docker",
    label: "Install Docker",
    hint: "Install Docker CE and Docker Compose plugin on a server",
    run: runInstallDockerCommand
  },
  {
    id: "uninstall-docker",
    label: "Uninstall Docker",
    hint: "Remove Docker packages and delete containers, images, networks, and volumes",
    run: runUninstallDockerCommand
  }
];

async function runManageServerDockerFlow(): Promise<void> {
  while (true) {
    const selected = await promptSelect(
      [
        ...dockerCommandDefinitions.map<SelectOption<DockerCommandId>>((command) => ({
          value: command.id,
          label: command.label,
          hint: command.hint
        })),
        {
          value: "back",
          label: "Back",
          hint: "Return to Manage servers"
        }
      ],
      "Docker"
    );

    if (selected === "back") {
      return;
    }

    const command = dockerCommandDefinitions.find((definition) => definition.id === selected);

    if (!command) {
      throw new Error(`Unknown Docker command: ${selected}`);
    }

    await command.run();
  }
}
