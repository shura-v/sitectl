import { isPromptCancelledError, promptSelect } from "../../cli.js";
import { runAddCaddySiteAction } from "./add-site.js";
import { runCopyCaddyConfFilesToServerAction } from "./copy-conf-files-to-server.js";
import { runInstallCaddyAction } from "./install-caddy.js";
import { runOpenCaddyfileAction } from "./open-caddyfile.js";
import { runRemoveCaddySiteFromServerAction } from "./remove-site-from-server.js";
import { runUninstallCaddyAction } from "./uninstall-caddy.js";

type ManageCaddyAction =
  | "install-caddy"
  | "uninstall-caddy"
  | "add-site"
  | "open-caddyfile"
  | "copy-conf-files-to-server"
  | "remove-site-from-server"
  | "back";

export async function runManageCaddyCommand(): Promise<void> {
  while (true) {
    let action: ManageCaddyAction;

    try {
      action = await promptSelect(
        [
          {
            value: "install-caddy",
            label: "Install Caddy",
            hint: "Install the official Caddy package on a server"
          },
          {
            value: "uninstall-caddy",
            label: "Uninstall Caddy",
            hint: "Remove Caddy, Caddy configs, certificates, and data from a server"
          },
          {
            value: "add-site",
            label: "Add site",
            hint: "Create a site folder in the local Caddy registry"
          },
          {
            value: "open-caddyfile",
            label: "Open Caddyfile",
            hint: "Open the local Caddyfile for a site"
          },
          {
            value: "copy-conf-files-to-server",
            label: "Copy conf files to server",
            hint: "Upload a site Caddyfile and reload Caddy"
          },
          {
            value: "remove-site-from-server",
            label: "Remove site from server",
            hint: "Delete the remote Caddy site config and keep the local config"
          },
          {
            value: "back",
            label: "Back",
            hint: "Return to the main menu"
          }
        ],
        "Manage caddy"
      );
    } catch (error) {
      if (isPromptCancelledError(error)) {
        return;
      }

      throw error;
    }

    if (action === "back") {
      return;
    }

    try {
      switch (action) {
        case "install-caddy":
          await runInstallCaddyAction();
          break;
        case "uninstall-caddy":
          await runUninstallCaddyAction();
          break;
        case "add-site":
          await runAddCaddySiteAction();
          break;
        case "open-caddyfile":
          await runOpenCaddyfileAction();
          break;
        case "copy-conf-files-to-server":
          await runCopyCaddyConfFilesToServerAction();
          break;
        case "remove-site-from-server":
          await runRemoveCaddySiteFromServerAction();
          break;
      }
    } catch (error) {
      if (isPromptCancelledError(error)) {
        continue;
      }

      throw error;
    }
  }
}
