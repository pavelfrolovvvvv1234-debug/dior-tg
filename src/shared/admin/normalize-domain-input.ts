/**
 * Normalize domain input (ASCII + IDN / punycode) for admin flows.
 *
 * @module shared/admin/normalize-domain-input
 */

import * as punycode from "node:punycode";

const ASCII_DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function normalizeAdminDomainFqdn(raw: string): { fqdn: string } | { error: string } {
  let s = raw.trim().toLowerCase();
  if (!s) return { error: "empty" };
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  if (s.startsWith("www.")) s = s.slice(4);
  if (!s.includes(".")) {
    return { error: "no_tld" };
  }

  const labels = s.split(".").filter(Boolean);
  if (labels.length < 2) {
    return { error: "no_tld" };
  }

  const encoded: string[] = [];
  for (const label of labels) {
    if (!label.length || label.length > 63) {
      return { error: "invalid_label" };
    }
    try {
      encoded.push(punycode.toASCII(label));
    } catch {
      return { error: "invalid_label" };
    }
  }

  const fqdn = encoded.join(".").toLowerCase();
  if (!ASCII_DOMAIN_RE.test(fqdn)) {
    return { error: "invalid_format" };
  }
  return { fqdn };
}
