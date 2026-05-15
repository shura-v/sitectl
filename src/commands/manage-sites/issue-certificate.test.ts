import { describe, expect, it } from "vitest";
import {
  buildCertbotIssueCommand,
  buildRemotePythonCertbotInstallCommand,
  isCertbotVersionAtLeast,
  parseCertbotVersion
} from "./issue-certificate.js";

describe("buildCertbotIssueCommand", () => {
  it("builds the nginx flow for domain hosts", () => {
    expect(
      buildCertbotIssueCommand({
        hostKind: "domain",
        siteName: "example.com"
      })
    ).toBe("certbot certonly --nginx -d 'example.com'");
  });

  it("builds the webroot short-lived flow for IP hosts", () => {
    expect(
      buildCertbotIssueCommand({
        hostKind: "ipv6",
        siteName: "2a11:3b80:1::dc9"
      })
    ).toBe(
      "certbot certonly --preferred-profile shortlived --webroot --webroot-path '/var/www/letsencrypt' --deploy-hook 'systemctl reload nginx' --ip-address '2a11:3b80:1::dc9'"
    );
  });

  it("uses a custom certbot executable when provided", () => {
    expect(
      buildCertbotIssueCommand({
        certbotExecutable: "/opt/certbot/bin/certbot",
        hostKind: "ipv4",
        siteName: "203.0.113.10"
      })
    ).toBe(
      "'/opt/certbot/bin/certbot' certonly --preferred-profile shortlived --webroot --webroot-path '/var/www/letsencrypt' --deploy-hook 'systemctl reload nginx' --ip-address '203.0.113.10'"
    );
  });
});

describe("buildRemotePythonCertbotInstallCommand", () => {
  it("installs an isolated certbot and writes a renewal cron file", () => {
    const command = buildRemotePythonCertbotInstallCommand(false);

    expect(command).toContain("sudo apt update");
    expect(command).toContain("sudo apt install -y python3 python3-venv libaugeas-dev gcc");
    expect(command).toContain("sudo python3 -m venv /opt/certbot");
    expect(command).toContain("sudo /opt/certbot/bin/pip install --upgrade certbot certbot-nginx");
    expect(command).toContain("/etc/cron.d/sitectl-certbot-renew");
    expect(command).toContain("/opt/certbot/bin/certbot renew -q");
  });
});

describe("parseCertbotVersion", () => {
  it("parses a plain certbot version string", () => {
    expect(parseCertbotVersion("certbot 5.4.0")).toBe("5.4.0");
  });

  it("parses a version string with extra text", () => {
    expect(parseCertbotVersion("certbot 5.4.1 from /usr/lib/python3/dist-packages/certbot")).toBe(
      "5.4.1"
    );
  });
});

describe("isCertbotVersionAtLeast", () => {
  it("accepts equal versions", () => {
    expect(isCertbotVersionAtLeast("5.4.0", "5.4.0")).toBe(true);
  });

  it("accepts newer versions", () => {
    expect(isCertbotVersionAtLeast("5.5.0", "5.4.0")).toBe(true);
  });

  it("rejects older versions", () => {
    expect(isCertbotVersionAtLeast("5.3.9", "5.4.0")).toBe(false);
  });
});
