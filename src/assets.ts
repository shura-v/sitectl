import { readFile } from "node:fs/promises";

export async function readAssetText(relativePath: string): Promise<string> {
  const assetUrl = new URL(`../assets/${relativePath}`, import.meta.url);
  return readFile(assetUrl, "utf8");
}
