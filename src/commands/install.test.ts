import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { copyRemoteEntries, findInstalledRemoteEntries } from "./install.js";
import { discoverRemoteMenuEntriesInDirectory } from "./remote-commands.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  );
});

describe("copyRemoteEntries", () => {
  it("replaces an installed submenu and drops files removed upstream", async () => {
    const source = await createTempDirectory();
    await writeFile(join(source, "tool.json"), JSON.stringify({ name: "Tool" }));
    await mkdir(join(source, "tool"));
    await writeFile(join(source, "tool", "install.json"), JSON.stringify({ name: "Install" }));
    await writeFile(join(source, "tool", "install.sh"), "new\n");
    await writeFile(join(source, "other.json"), JSON.stringify({ name: "Other" }));
    await writeFile(join(source, "other.sh"), "other\n");

    const target = await createTempDirectory();
    await writeFile(join(target, "tool.json"), JSON.stringify({ name: "Old tool" }));
    await mkdir(join(target, "tool"));
    await writeFile(join(target, "tool", "install.sh"), "old\n");
    await writeFile(join(target, "tool", "stale.sh"), "stale\n");

    const entries = await discoverRemoteMenuEntriesInDirectory(source, "");
    const tool = entries.filter((entry) => entry.relativePath === "tool");

    expect(await findInstalledRemoteEntries(target, entries)).toEqual(tool);

    await copyRemoteEntries(source, target, tool);

    expect(await readFile(join(target, "tool", "install.sh"), "utf8")).toBe("new\n");
    await expect(access(join(target, "tool", "stale.sh"))).rejects.toThrow();
    await expect(access(join(target, "other.sh"))).rejects.toThrow();
  });
});

async function createTempDirectory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "sitectl-install-test-"));
  tempDirectories.push(path);
  return path;
}
