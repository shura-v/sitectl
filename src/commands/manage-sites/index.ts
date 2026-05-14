import { isPromptCancelledError, promptSelect } from "../../cli.js";
import { runAddSiteAction } from "./add-site.js";
import { runCopyConfFilesToServerAction } from "./copy-conf-files-to-server.js";
import { runDisableHttpsAction } from "./disable-https.js";
import { runEnableHttpsAction } from "./enable-https.js";
import { runIssueCertificateAction } from "./issue-certificate.js";
import { runOpenNginxConfAction } from "./open-nginx-conf.js";
import { runRemoveSiteFromServerAction } from "./remove-site-from-server.js";

type ManageSitesAction =
  | "add-site"
  | "open-nginx-conf"
  | "copy-conf-files-to-server"
  | "issue-certificate"
  | "enable-https"
  | "disable-https"
  | "remove-site-from-server"
  | "back";

export async function runManageSitesCommand(): Promise<void> {
  while (true) {
    let action: ManageSitesAction;

    try {
      action = await promptSelect(
        [
          {
            value: "add-site",
            label: "Add site",
            hint: "Create a site folder in the local nginx registry"
          },
          {
            value: "open-nginx-conf",
            label: "Open nginx.conf",
            hint: "Open the local nginx.conf for a site"
          },
          {
            value: "copy-conf-files-to-server",
            label: "Copy conf files to server",
            hint: "Upload bootstrap + https nginx configs to a server"
          },
          {
            value: "issue-certificate",
            label: "Issue certificate",
            hint: "Run certbot certonly --nginx for the selected site"
          },
          {
            value: "enable-https",
            label: "Enable https",
            hint: "Link the main HTTPS config into sites-enabled"
          },
          {
            value: "disable-https",
            label: "Disable https",
            hint: "Switch the site back to the bootstrap HTTP config"
          },
          {
            value: "remove-site-from-server",
            label: "Remove site from server",
            hint: "Delete remote nginx config, symlink, and certificate"
          },
          {
            value: "back",
            label: "Back",
            hint: "Return to the main menu"
          }
        ],
        "Manage sites"
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
        case "add-site":
          await runAddSiteAction();
          break;
        case "open-nginx-conf":
          await runOpenNginxConfAction();
          break;
        case "copy-conf-files-to-server":
          await runCopyConfFilesToServerAction();
          break;
        case "issue-certificate":
          await runIssueCertificateAction();
          break;
        case "enable-https":
          await runEnableHttpsAction();
          break;
        case "disable-https":
          await runDisableHttpsAction();
          break;
        case "remove-site-from-server":
          await runRemoveSiteFromServerAction();
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
