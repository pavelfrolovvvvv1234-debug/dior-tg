/**
 * Zod validation for admin manual service creation.
 *
 * @module modules/admin/manual-services/schemas
 */

import { z } from "zod";

const ipv4Re =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

const domainRe = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

const dateFlexible = z
  .string()
  .trim()
  .min(1)
  .refine((s) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    if (/^\d{2}\.\d{2}\.\d{2,4}$/.test(s)) return true;
    const d = new Date(s);
    return Number.isFinite(d.getTime());
  }, "Invalid date (use YYYY-MM-DD or DD.MM.YY)");

export const domainServiceSchema = z.object({
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .regex(domainRe, "Invalid domain (e.g. example.com)"),
  registrar: z.string().trim().min(1).max(120),
  expiresAt: dateFlexible,
  ns1: z.string().trim().max(253).optional().or(z.literal("")),
  ns2: z.string().trim().max(253).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional(),
});

export const vdsServiceSchema = z.object({
  ipv4: z.string().trim().regex(ipv4Re, "Invalid IPv4"),
  login: z.string().trim().min(1).max(64),
  password: z.string().trim().min(1).max(256),
  provider: z.string().trim().min(1).max(120),
  osLabel: z.string().trim().min(1).max(120),
  sshPort: z.coerce.number().int().min(1).max(65535).optional(),
  vmid: z.coerce.number().int().min(100).max(999_999_999).optional(),
  rateName: z.string().trim().min(1).max(64),
  expireAt: dateFlexible,
  cpuCount: z.coerce.number().int().min(1).max(256),
  ramGb: z.coerce.number().int().min(1).max(2048),
  diskGb: z.coerce.number().int().min(1).max(100_000),
  renewalPrice: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(2000).optional(),
});

export const dedicatedServiceSchema = z.object({
  ipv4: z.string().trim().regex(ipv4Re, "Invalid IPv4"),
  provider: z.string().trim().min(1).max(120),
  login: z.string().trim().min(1).max(64),
  password: z.string().trim().min(1).max(256),
  rackLocation: z.string().trim().min(1).max(200),
  hardwareInfo: z.string().trim().min(1).max(2000),
  monthlyPrice: z.coerce.number().min(0).max(1_000_000).optional(),
  paidUntil: dateFlexible.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export function parseFlexibleDate(input: string): Date {
  const s = input.trim();
  const dot = /^(\d{2})\.(\d{2})\.(\d{2,4})$/.exec(s);
  if (dot) {
    const day = Number(dot[1]);
    const month = Number(dot[2]);
    let year = Number(dot[3]);
    if (year < 100) year += 2000;
    return new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T23:59:59.000Z`);
  }
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) {
    throw new Error("Invalid date");
  }
  return d;
}

export function validateManualServiceDraft(
  type: "domain" | "vds" | "dedicated",
  draft: Record<string, unknown>
): { ok: true } | { ok: false; message: string } {
  const schema =
    type === "domain"
      ? domainServiceSchema
      : type === "vds"
        ? vdsServiceSchema
        : dedicatedServiceSchema;
  const result = schema.safeParse(draft);
  if (result.success) return { ok: true };
  const issue = result.error.issues[0];
  const path = issue?.path?.length ? `${String(issue.path.join("."))}: ` : "";
  return { ok: false, message: `${path}${issue?.message ?? "Validation failed"}` };
}

export function splitDomainFqdn(fqdn: string): { domain: string; tld: string } {
  const parts = fqdn.trim().toLowerCase().split(".");
  if (parts.length < 2) {
    throw new Error("Invalid domain");
  }
  const tld = parts.pop() ?? "";
  const domain = parts.join(".");
  return { domain, tld };
}
