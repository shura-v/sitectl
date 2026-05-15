import { describe, expect, it } from "vitest";
import { parseCertbotLineage } from "./shared.js";

describe("parseCertbotLineage", () => {
  it("parses legacy Domains output", () => {
    const output = [
      "Certificate Name: example.com",
      "    Domains: example.com www.example.com"
    ].join("\n");

    expect(parseCertbotLineage(output, "example.com")).toEqual({
      certificateName: "example.com",
      domains: ["example.com", "www.example.com"]
    });
  });

  it("parses Identifiers output for IP certificates", () => {
    const output = [
      "Certificate Name: 2a11:3b80:1::dc9",
      "    Identifiers: IP:2a11:3b80:1::dc9"
    ].join("\n");

    expect(parseCertbotLineage(output, "2a11:3b80:1::dc9")).toEqual({
      certificateName: "2a11:3b80:1::dc9",
      domains: ["2a11:3b80:1::dc9"]
    });
  });

  it("matches bracketed IPv6 site names against normalized identifiers", () => {
    const output = [
      "Certificate Name: 2a11:3b80:1::dc9",
      "    Identifiers: IP:2a11:3b80:1::dc9"
    ].join("\n");

    expect(parseCertbotLineage(output, "[2a11:3b80:1::dc9]")?.certificateName).toBe(
      "2a11:3b80:1::dc9"
    );
  });
});
