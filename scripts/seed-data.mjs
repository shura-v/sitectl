import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = join(rootDir, "config");
const targetDir = join(homedir(), ".config", "sitectl");

await seedDirectory(sourceDir);

async function seedDirectory(currentSourceDir) {
  const entries = await readdir(currentSourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(currentSourceDir, entry.name);
    const relativePath = relative(sourceDir, sourcePath);
    const targetPath = join(targetDir, relativePath);

    if (entry.isDirectory()) {
      await mkdir(targetPath, { recursive: true });
      await seedDirectory(sourcePath);
      continue;
    }

    await mkdir(dirname(targetPath), { recursive: true });

    try {
      await access(targetPath);
    } catch {
      await copyFile(sourcePath, targetPath);
    }
  }
}
