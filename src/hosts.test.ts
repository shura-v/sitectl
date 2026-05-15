import { describe, expect, it } from "vitest";
import { detectHostKind, formatNginxServerName, normalizeHostValue } from "./hosts.js";
import { joinTemplateSections, renderSiteTemplate } from "./sites.js";
import {
  formatRsyncHost,
  formatServerRsyncDestination
} from "./commands/utils/server-target.js";

describe("detectHostKind", () => {
  it("detects domain hosts", () => {
    expect(detectHostKind("example.com")).toBe("domain");
  });

  it("detects IPv4 hosts", () => {
    expect(detectHostKind("203.0.113.10")).toBe("ipv4");
  });

  it("detects IPv6 hosts", () => {
    expect(detectHostKind("2001:db8::10")).toBe("ipv6");
  });

  it("detects bracketed IPv6 hosts", () => {
    expect(detectHostKind("[2001:db8::10]")).toBe("ipv6");
  });
});

describe("normalizeHostValue", () => {
  it("keeps domains unchanged", () => {
    expect(normalizeHostValue("example.com")).toBe("example.com");
  });

  it("strips brackets from IPv6 literals", () => {
    expect(normalizeHostValue("[2001:db8::10]")).toBe("2001:db8::10");
  });
});

describe("formatNginxServerName", () => {
  it("keeps domain names unchanged", () => {
    expect(formatNginxServerName("example.com")).toBe("example.com");
  });

  it("keeps IPv4 addresses unchanged", () => {
    expect(formatNginxServerName("203.0.113.10")).toBe("203.0.113.10");
  });

  it("wraps IPv6 addresses in brackets", () => {
    expect(formatNginxServerName("2001:db8::10")).toBe("[2001:db8::10]");
  });

  it("avoids double-bracketing IPv6 addresses", () => {
    expect(formatNginxServerName("[2001:db8::10]")).toBe("[2001:db8::10]");
  });
});

describe("renderSiteTemplate", () => {
  it("renders bracketed server_name but raw site paths for IPv6 hosts", () => {
    const rendered = renderSiteTemplate(
      "server_name __SERVER_NAME__;\nroot /var/www/__SITE_NAME__;\nssl_certificate /etc/letsencrypt/live/__SITE_NAME__/fullchain.pem;\n",
      "2001:db8::10"
    );

    expect(rendered).toContain("server_name [2001:db8::10];");
    expect(rendered).toContain("root /var/www/2001:db8::10;");
    expect(rendered).toContain(
      "ssl_certificate /etc/letsencrypt/live/2001:db8::10/fullchain.pem;"
    );
  });

  it("keeps old __SITE_NAME__ server_name placeholders working for IPv6", () => {
    const rendered = renderSiteTemplate(
      "server_name __SITE_NAME__;\nroot /var/www/__SITE_NAME__;\n",
      "2001:db8::10"
    );

    expect(rendered).toContain("server_name [2001:db8::10];");
    expect(rendered).toContain("root /var/www/2001:db8::10;");
  });
});

describe("joinTemplateSections", () => {
  it("joins bundled sections into a single nginx template", () => {
    expect(joinTemplateSections("server {\n}\n", "\nserver {\n}\n")).toBe(
      "server {\n}\n\nserver {\n}\n"
    );
  });
});

describe("formatRsyncHost", () => {
  it("keeps domain names unchanged", () => {
    expect(formatRsyncHost("example.com")).toBe("example.com");
  });

  it("keeps IPv4 addresses unchanged", () => {
    expect(formatRsyncHost("203.0.113.10")).toBe("203.0.113.10");
  });

  it("wraps IPv6 addresses in brackets", () => {
    expect(formatRsyncHost("2001:db8::10")).toBe("[2001:db8::10]");
  });
});

describe("formatServerRsyncDestination", () => {
  it("renders a plain IPv4 rsync destination", () => {
    expect(
      formatServerRsyncDestination(
        {
          address: "203.0.113.10",
          flag: "🌍",
          port: 22,
          user: "root"
        },
        "/etc/nginx/sites-available/"
      )
    ).toBe("root@203.0.113.10:/etc/nginx/sites-available/");
  });

  it("renders a bracketed IPv6 rsync destination", () => {
    expect(
      formatServerRsyncDestination(
        {
          address: "2001:db8::10",
          flag: "🌍",
          port: 22,
          user: "root"
        },
        "/etc/nginx/sites-available/"
      )
    ).toBe("root@[2001:db8::10]:/etc/nginx/sites-available/");
  });
});
