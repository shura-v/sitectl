import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildRsyncArgs, resolveLocalSourcePath } from "./sync-files-to-server.js";

describe("buildRsyncArgs", () => {
  it("builds rsync argv for a single literal local source path", () => {
    const args = buildRsyncArgs({
      localSourcePath: "./My App/build.tgz",
      remotePath: "/opt/db/",
      server: {
        address: "203.0.113.10",
        flag: "🌍",
        port: 2222,
        user: "root"
      }
    });

    expect(args).toEqual([
      "-avz",
      "-e",
      "ssh -p 2222",
      "--",
      "./My App/build.tgz",
      "root@203.0.113.10:/opt/db/"
    ]);
  });

  it("quotes remote destinations with spaces and metacharacters", () => {
    const args = buildRsyncArgs({
      localSourcePath: "report[final]$backup.txt",
      remotePath: "~/My App/a[1]/",
      server: {
        address: "203.0.113.10",
        flag: "🌍",
        port: 22,
        user: "deploy"
      }
    });

    expect(args).toEqual([
      "-avz",
      "-e",
      "ssh -p 22",
      "--",
      "report[final]$backup.txt",
      "deploy@203.0.113.10:~/'My App'/'a[1]'/"
    ]);
  });
});

describe("resolveLocalSourcePath", () => {
  it("keeps an existing literal path unchanged", async () => {
    expect(await resolveLocalSourcePath("./package.json")).toBe("./package.json");
  });

  it("resolves a glob when it matches exactly one path", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sitectl-sync-"));
    await writeFile(join(directory, "build.tgz"), "ok", "utf8");

    await expect(resolveLocalSourcePath(join(directory, "*.tgz"))).resolves.toBe(
      join(directory, "build.tgz")
    );
  });

  it("preserves a trailing slash when a glob resolves to one directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sitectl-sync-"));
    await mkdir(join(directory, "artifact"), { recursive: true });

    await expect(resolveLocalSourcePath(join(directory, "*/"))).resolves.toBe(
      `${join(directory, "artifact")}/`
    );
  });

  it("rejects globs that match multiple paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sitectl-sync-"));
    await writeFile(join(directory, "a.tgz"), "a", "utf8");
    await writeFile(join(directory, "b.tgz"), "b", "utf8");

    await expect(resolveLocalSourcePath(join(directory, "*.tgz"))).rejects.toThrow(
      "matched multiple paths"
    );
  });

  it("supports literal paths that contain glob-like characters", async () => {
    const directory = await mkdtemp(join(tmpdir(), "sitectl-sync-"));
    await mkdir(join(directory, "report[final]"), { recursive: true });
    const filePath = join(directory, "report[final]", "price$backup.json");
    await writeFile(filePath, "{}", "utf8");

    await expect(resolveLocalSourcePath(filePath)).resolves.toBe(filePath);
  });
});
