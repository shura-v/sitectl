import { cancel } from "@clack/prompts";
import type { SelectOption } from "../../cli.js";
import { isPromptCancelledError, promptSelect } from "../../cli.js";
import { runAddServerCommand } from "./add-server.js";
import { runDeleteServerCommand } from "./delete-server.js";
import { runEditServerCommand } from "./edit-server.js";
import { runSshCommand } from "../ssh.js";
import { runSshCopyIdCommand } from "../ssh-copy-id.js";

type ServerCommandId =
  | "add-server"
  | "edit-server"
  | "delete-server"
  | "ssh-copy-id"
  | "ssh"
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
