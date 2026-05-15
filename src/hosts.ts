import { isIP } from "node:net";

export type HostKind = "domain" | "ipv4" | "ipv6";

export function normalizeHostValue(value: string): string {
  const normalizedValue = value.trim();
  const bracketedIpv6Match = normalizedValue.match(/^\[([^[\]]+)\]$/);
  const bracketedIpv6Value = bracketedIpv6Match?.[1];

  if (bracketedIpv6Value && isIP(bracketedIpv6Value) === 6) {
    return bracketedIpv6Value;
  }

  return normalizedValue;
}

export function detectHostKind(value: string): HostKind {
  const normalizedValue = normalizeHostValue(value);
  const ipVersion = isIP(normalizedValue);

  if (ipVersion === 4) {
    return "ipv4";
  }

  if (ipVersion === 6) {
    return "ipv6";
  }

  return "domain";
}

export function isIpHost(value: string): boolean {
  return detectHostKind(value) !== "domain";
}

export function formatNginxServerName(value: string): string {
  const normalizedValue = normalizeHostValue(value);
  return detectHostKind(normalizedValue) === "ipv6" ? `[${normalizedValue}]` : normalizedValue;
}
