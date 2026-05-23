import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildRemoteCommandResolutionError,
  discoverRemoteMenuEntriesInDirectory,
  findRemoteMenuEntryByFilePathSegments,
  formatRunnableRemoteCommandList,
  resolveRemoteCommandPromptValue,
  resolveRemoteMenuEntryByFilePathSegments,
  shouldPromptForRemoteCommandConfirmation
} from "./remote-commands.js";

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

  it("throws when prompts is not an array", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "danger.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "danger.json"), JSON.stringify({ name: "Danger", prompts: true }));

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "danger.json" must contain an array "prompts" when provided.'
    );
  });

  it("accepts select prompts metadata on a command", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "disk.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "disk.json"),
      JSON.stringify({
        name: "Disk usage",
        prompts: [
          {
            env: "SITECTL_DOCKER_SYSTEM_DF_MODE",
            message: "Select output mode",
            options: [
              { label: "Normal", value: "normal" },
              { label: "Verbose", value: "verbose", hint: "Includes per-image and per-container rows" }
            ]
          }
        ]
      })
    );

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "command",
      name: "Disk usage",
      relativePath: "disk.sh",
      prompts: [
        {
          env: "SITECTL_DOCKER_SYSTEM_DF_MODE",
          message: "Select output mode",
          options: [
            { label: "Normal", value: "normal" },
            {
              label: "Verbose",
              value: "verbose",
              hint: "Includes per-image and per-container rows"
            }
          ]
        }
      ]
    });
  });

  it("throws when submenu metadata contains prompts", async () => {
    const root = await createTempDirectory();
    await mkdir(join(root, "docker"));
    await writeFile(
      join(root, "docker.json"),
      JSON.stringify({
        name: "Docker",
        prompts: [
          {
            env: "SITECTL_DOCKER_MODE",
            message: "Select output mode",
            options: [{ label: "Normal", value: "normal" }]
          }
        ]
      })
    );

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote submenu metadata "docker.json" cannot contain "prompts". Prompts are supported only on runnable commands.'
    );
  });

  it("throws when a prompt env uses a reserved built-in name", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "disk.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "disk.json"),
      JSON.stringify({
        name: "Disk usage",
        prompts: [
          {
            env: "SITECTL_SERVER_NAME",
            message: "Select output mode",
            options: [{ label: "Normal", value: "normal" }]
          }
        ]
      })
    );

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "disk.json" prompt #1 env "SITECTL_SERVER_NAME" is reserved for built-in server values.'
    );
  });

  it("throws when prompt env names are duplicated", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "disk.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "disk.json"),
      JSON.stringify({
        name: "Disk usage",
        prompts: [
          {
            env: "SITECTL_DOCKER_MODE",
            message: "Select first output mode",
            options: [{ label: "Normal", value: "normal" }]
          },
          {
            env: "SITECTL_DOCKER_MODE",
            message: "Select second output mode",
            options: [{ label: "Verbose", value: "verbose" }]
          }
        ]
      })
    );

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "disk.json" prompt #2 env "SITECTL_DOCKER_MODE" duplicates an earlier prompt env.'
    );
  });

  it("throws when uploads is not an array", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "upload.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "upload.json"), JSON.stringify({ name: "Upload", uploads: true }));

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "upload.json" must contain an array "uploads" when provided.'
    );
  });

  it("throws when an upload entry has no from value", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "upload.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "upload.json"),
      JSON.stringify({ name: "Upload", uploads: [{ to: "/tmp/file.txt" }] })
    );

    await expect(discoverRemoteMenuEntriesInDirectory(root, "")).rejects.toThrow(
      'Remote metadata "upload.json" upload #1 must contain a non-empty "from" string.'
    );
  });

  it("accepts uploads metadata on a command", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "upload.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "upload.json"),
      JSON.stringify({
        name: "Upload",
        uploads: [{ from: "./dist/*.tgz", to: "/tmp/releases/build.tgz" }]
      })
    );

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "command",
      name: "Upload",
      relativePath: "upload.sh"
    });
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

describe("findRemoteMenuEntryByFilePathSegments", () => {
  it("resolves a nested command by its file path segments", async () => {
    const root = await createTempDirectory();
    await mkdir(join(root, "docker"));
    await writeFile(join(root, "docker.json"), JSON.stringify({ name: "Docker" }));
    await writeFile(join(root, "docker", "install-docker.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "docker", "install-docker.json"),
      JSON.stringify({ name: "Install Docker" })
    );

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");
    const entry = findRemoteMenuEntryByFilePathSegments(entries, ["docker", "install-docker"]);

    expect(entry).toMatchObject({
      kind: "command",
      name: "Install Docker",
      relativePath: "docker/install-docker.sh"
    });
  });

  it("returns a submenu when the file path ends at a submenu", async () => {
    const root = await createTempDirectory();
    await mkdir(join(root, "docker"));
    await writeFile(join(root, "docker.json"), JSON.stringify({ name: "Docker" }));

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");
    const entry = findRemoteMenuEntryByFilePathSegments(entries, ["docker"]);

    expect(entry).toMatchObject({
      kind: "submenu",
      name: "Docker",
      relativePath: "docker"
    });
  });

  it("returns undefined for a missing file path", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "deploy.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "deploy.json"), JSON.stringify({ name: "Deploy to prod" }));

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");
    const entry = findRemoteMenuEntryByFilePathSegments(entries, ["missing-command"]);

    expect(entry).toBeUndefined();
  });
});

describe("formatRunnableRemoteCommandList", () => {
  it("flattens nested runnable commands using file path syntax", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "deploy.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "deploy.json"), JSON.stringify({ name: "Deploy to prod" }));
    await mkdir(join(root, "docker"));
    await writeFile(join(root, "docker.json"), JSON.stringify({ name: "Docker" }));
    await writeFile(join(root, "docker", "install-docker.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "docker", "install-docker.json"),
      JSON.stringify({ name: "Install Docker" })
    );

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");

    expect(formatRunnableRemoteCommandList(entries)).toBe(
      "- deploy: Deploy to prod\n- docker/install-docker: Install Docker"
    );
  });
});

describe("shouldPromptForRemoteCommandConfirmation", () => {
  it("keeps confirmations for interactive menu runs", () => {
    expect(shouldPromptForRemoteCommandConfirmation()).toBe(true);
  });

  it("skips confirmations for non-interactive cli runs", () => {
    expect(shouldPromptForRemoteCommandConfirmation("my-server")).toBe(false);
  });
});

describe("resolveRemoteCommandPromptValue", () => {
  const prompt = {
    env: "SITECTL_DOCKER_SYSTEM_DF_MODE",
    message: "Select output mode",
    options: [
      { label: "Normal", value: "normal" },
      { label: "Verbose", value: "verbose", hint: "Includes per-image and per-container rows" }
    ]
  };

  const originalEnvValue = process.env.SITECTL_DOCKER_SYSTEM_DF_MODE;

  afterEach(() => {
    if (originalEnvValue === undefined) {
      delete process.env.SITECTL_DOCKER_SYSTEM_DF_MODE;
      return;
    }

    process.env.SITECTL_DOCKER_SYSTEM_DF_MODE = originalEnvValue;
  });

  it("reads prompt values from the local environment for cli runs", () => {
    process.env.SITECTL_DOCKER_SYSTEM_DF_MODE = "verbose";

    expect(resolveRemoteCommandPromptValue(prompt, "my-server")).toBe("verbose");
  });

  it("throws when the local environment variable is missing for cli runs", () => {
    delete process.env.SITECTL_DOCKER_SYSTEM_DF_MODE;

    expect(() => resolveRemoteCommandPromptValue(prompt, "my-server")).toThrow(
      'Remote command prompt "Select output mode" requires local env SITECTL_DOCKER_SYSTEM_DF_MODE when using "sitectl run ... my-server".'
    );
  });

  it("throws when the local environment variable has an unsupported value", () => {
    process.env.SITECTL_DOCKER_SYSTEM_DF_MODE = "full";

    expect(() => resolveRemoteCommandPromptValue(prompt, "my-server")).toThrow(
      "Local env SITECTL_DOCKER_SYSTEM_DF_MODE must be one of: normal, verbose."
    );
  });
});

describe("buildRemoteCommandResolutionError", () => {
  it("shows submenu contents when the path ends at a submenu", async () => {
    const root = await createTempDirectory();
    await mkdir(join(root, "docker"));
    await writeFile(join(root, "docker.json"), JSON.stringify({ name: "Docker" }));
    await writeFile(join(root, "docker", "install-docker.sh"), "#!/usr/bin/env bash\n");
    await writeFile(
      join(root, "docker", "install-docker.json"),
      JSON.stringify({ name: "Install Docker" })
    );

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");
    const resolution = resolveRemoteMenuEntryByFilePathSegments(entries, ["docker"]);

    expect(buildRemoteCommandResolutionError(["docker"], resolution)).toBe(
      'Remote command path points to a submenu, not a command: docker.\nAvailable entries in remote/docker/:\n- install-docker: Install Docker (command)'
    );
  });

  it("shows available entries on the current level when a path segment is missing", async () => {
    const root = await createTempDirectory();
    await writeFile(join(root, "deploy.sh"), "#!/usr/bin/env bash\n");
    await writeFile(join(root, "deploy.json"), JSON.stringify({ name: "Deploy to prod" }));
    await mkdir(join(root, "docker"));
    await writeFile(join(root, "docker.json"), JSON.stringify({ name: "Docker" }));

    const entries = await discoverRemoteMenuEntriesInDirectory(root, "");
    const resolution = resolveRemoteMenuEntryByFilePathSegments(entries, ["missing-command"]);

    expect(buildRemoteCommandResolutionError(["missing-command"], resolution)).toBe(
      'Remote command not found: missing-command.\nAvailable entries in remote/:\n- deploy: Deploy to prod (command)\n- docker: Docker (submenu)'
    );
  });
});

async function createTempDirectory(): Promise<string> {
  const directoryPath = await mkdtemp(join(tmpdir(), "sitectl-remote-commands-"));
  tempDirectories.push(directoryPath);
  return directoryPath;
}
