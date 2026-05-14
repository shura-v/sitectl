import { mkdir } from "node:fs/promises";
import { outro } from "@clack/prompts";
import { getDataDirectoryPath } from "../config.js";
import { openLocalPath } from "./utils/open-local-path.js";

export async function runOpenDataDirCommand(): Promise<void> {
  const dataDirectoryPath = getDataDirectoryPath();
  await mkdir(dataDirectoryPath, { recursive: true });

  await openLocalPath(dataDirectoryPath);
  outro(`Opened ${dataDirectoryPath}.`);
}
