import { describe, expect, it } from "vitest";
import { buildSshArgs } from "./ssh.js";

describe("buildSshArgs", () => {
  it("appends a remote command after the ssh target", () => {
    expect(
      buildSshArgs(
        {
          address: "192.0.2.10",
          flag: "🌍",
          port: 2222,
          user: "deploy"
        },
        'echo "hello world!"'
      )
    ).toEqual(["-p", "2222", "deploy@192.0.2.10", 'echo "hello world!"']);
  });

  it("omits the remote command when it is not provided", () => {
    expect(
      buildSshArgs({
        address: "192.0.2.10",
        flag: "🌍",
        port: 2222,
        user: "deploy"
      })
    ).toEqual(["-p", "2222", "deploy@192.0.2.10"]);
  });
});
