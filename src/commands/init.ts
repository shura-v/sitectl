import { outro } from "@clack/prompts";
import { getDataPath, seedBundledDataFiles } from "../assets.js";
import { ensureConfigFile } from "../config.js";
import { initializeSiteTemplateFile } from "../sites.js";

export async function runInitCommand(options: {
  overwrite: boolean;
}): Promise<void> {
  await seedBundledDataFiles({ overwrite: options.overwrite });
  await initializeSiteTemplateFile({ overwrite: options.overwrite });
  await ensureConfigFile();

  outro(
    options.overwrite
      ? `Bundled templates overwritten in "${getDataPath(".")}".`
      : `sitectl initialized in "${getDataPath(".")}".`
  );
}
