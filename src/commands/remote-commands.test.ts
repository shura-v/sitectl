import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { discoverRemoteMenuEntriesInDirectory } from "./remote-commands.js";

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map(async (directoryPath) => {
      await rm(directoryPath, { recursive: true, force: true });
    })
  );
});

describe("discoverRemoteMenuEntriesInDirectory", () => {
  it("discovers commands and submenus from matching json files", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "install-base-packages.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "install-base-packages.json"),
      JSON.stringify({ name: "Install base packages" })
    );
    await mkdir(join(root, "docker"));
    await writeFile(join(root, "docker.json"), JSON.stringify({ name: "Docker" }));
    await writeFile(join(root, "docker", "install-docker.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "docker", "install-docker.json"),
      JSON.stringify({ name: "Install Docker" })
    );

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      kind: "submenu",
      name: "Docker",
      relativePath: "docker"
    });
    expect(entries[1]).toMatchObject({
      kind: "command",
      name: "Install base packages",
      relativePath: "install-base-packages.sh"
    });

    const dockerEntry = entries[0];

    expect(dockerEntry).toBeDefined();

    if (!dockerEntry || dockerEntry.kind !== "submenu") {
      throw new Error("Expected submenu.");
    }

    expect(dockerEntry.entries).toHaveLength(1);
    expect(dockerEntry.entries[0]).toMatchObject({
      kind: "command",
      name: "Install Docker",
      relativePath: "docker/install-docker.sh"
    });
  });

  it("ignores files without matching json metadata", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "custom.sh"), "#!/usr/bin/env bash\n");

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");

    expect(entries).toEqual([]);
  });

  it("throws when metadata has no matching command or submenu", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "broken.json"), JSON.stringify({ name: "Broken" }));

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "broken.json" has no matching command file or submenu directory.'
    );
  });

  it("throws when hidden is not a boolean", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "hidden.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "hidden.json"), JSON.stringify({ name: "Hidden", hidden: "false" }));

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "hidden.json" must contain a boolean "hidden" when provided.'
    );
  });

  it("throws when confirmation is not a string", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "danger.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "danger.json"), JSON.stringify({ name: "Danger", confirmation: true }));

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "danger.json" must contain a string "confirmation" when provided.'
    );
  });

  it("sorts by order first and then by name, with missing order at the bottom", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "gamma.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "gamma.json"), JSON.stringify({ name: "Gamma" }));
    await writeFile(join(root, "beta.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "beta.json"), JSON.stringify({ name: "Beta", order: 20 }));
    await writeFile(join(root, "alpha.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "alpha.json"), JSON.stringify({ name: "Alpha", order: 20 }));
    await writeFile(join(root, "first.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "first.json"), JSON.stringify({ name: "First", order: 10 }));

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");

    expect(entries.map((entry) => entry.name)).toEqual(["First", "Alpha", "Beta", "Gamma"]);
  });
});

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(join(tmpdir(), "sitectl-remote-commands-"));
  tempDirectories.push(directoryPath);
  return directoryPath;
}
