/**
 * Parse admin «add service» text lines (control panel quick add).
 *
 * @module shared/admin/parse-managed-service-input
 */

import {
  parseFlexibleDate,
  splitDomainFqdn,
} from "../../modules/admin/manual-services/schemas.js";
import { normalizeAdminDomainFqdn } from "./normalize-domain-input.js";
import {
  defaultAdminVpsExpireDate,
  resolveVdsPlanSpec,
} from "./vds-plan-catalog.js";

const ipv4Re =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export class AdminServiceInputError extends Error {
  constructor(
    message: string,
    readonly code:
      | "empty"
      | "need_date"
      | "invalid_domain"
      | "invalid_date"
      | "invalid_format" = "invalid_format"
  ) {
    super(message);
    this.name = "AdminServiceInputError";
  }
}

/** Preferred admin transfer date: DD.MM.YY or DD.MM.YYYY */
function looksLikeDateToken(token: string): boolean {
  const s = token.trim();
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
  if (/^\d{2}\/\d{2}\/\d{2,4}$/.test(s)) return true;
  if (!/\d/.test(s)) return false;
  try {
    parseFlexibleDate(s);
    return true;
  } catch {
    return false;
  }
}

function tokenizeLine(raw: string): string[] {
  const line = raw.trim();
  if (!line) return [];
  if (line.includes("|")) {
    return line
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
  }
  return line.split(/\s+/).map((p) => p.trim()).filter(Boolean);
}

function normalizeFqdn(raw: string): string {
  const r = normalizeAdminDomainFqdn(raw);
  if ("error" in r) {
    throw new AdminServiceInputError("Укажите домен с зоной, например example.com", "invalid_domain");
  }
  return r.fqdn;
}

/** Domain transfer line: domain + expiry; registrar optional (default transfer). */
export function parseAdminDomainTransferInput(raw: string): {
  fqdn: string;
  tld: string;
  registrar: string;
  expiresAt: Date;
} {
  const parts = tokenizeLine(raw);
  if (parts.length === 0) {
    throw new AdminServiceInputError("Пустая строка", "empty");
  }

  const fqdn = normalizeFqdn(parts[0]);
  let registrar = "transfer";
  let dateRaw: string | null = null;

  if (parts.length === 1) {
    throw new AdminServiceInputError(
      "Укажите дату окончания: example.com 2026-12-31 или example.com | 31.12.2026",
      "need_date"
    );
  }

  if (parts.length === 2) {
    if (looksLikeDateToken(parts[1])) {
      dateRaw = parts[1];
    } else {
      throw new AdminServiceInputError(
        "Второе поле должно быть датой (YYYY-MM-DD или 31.12.2026). Регистратор не обязателен.",
        "need_date"
      );
    }
  } else {
    const last = parts[parts.length - 1];
    if (!looksLikeDateToken(last)) {
      throw new AdminServiceInputError(
        "Последнее поле — дата окончания (YYYY-MM-DD или 31.12.2026)",
        "invalid_date"
      );
    }
    dateRaw = last;
    const middle = parts.slice(1, -1).join(" ").trim();
    if (middle) registrar = middle.slice(0, 120);
  }

  let expiresAt: Date;
  try {
    expiresAt = parseFlexibleDate(dateRaw!);
  } catch {
    throw new AdminServiceInputError(
      "Неверная дата. Используйте YYYY-MM-DD или DD.MM.YYYY",
      "invalid_date"
    );
  }

  const { tld } = splitDomainFqdn(fqdn);
  return { fqdn, tld, registrar: registrar || "transfer", expiresAt };
}

/** «Lite1» → «Lite 1» (как в prices.json). */
export function normalizeAdminPlanName(plan: string): string {
  const t = plan.trim();
  if (!t) return "Custom";
  return t.replace(/([A-Za-zА-Яа-я]+)(\d+)/gu, "$1 $2").replace(/\s+/g, " ").trim();
}

function parsePriceToken(token: string): number {
  const n = Number.parseFloat(token.replace(",", ".").replace(/\$/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    throw new AdminServiceInputError(
      "Цена должна быть числом, например 24 или 99.50",
      "invalid_format"
    );
  }
  return n;
}

export type AdminVpsServiceBlock = {
  username?: string;
  vmid: number;
  plan: string;
  ip: string;
  price?: number;
  expiresAt?: Date;
};

function extractVmidToken(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Multi-line admin paste, e.g. @user / ID vm: 230 / Tarif: Mega 1 / Ip: ... */
export function tryParseAdminVpsServiceBlock(raw: string): AdminVpsServiceBlock | null {
  const text = raw.trim();
  if (!text) return null;

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const looksLikeBlock =
    lines.length >= 2 ||
    /(?:^|\n)\s*(?:id\s*vm|vm\s*id|vmid|tarif|tariff|тариф)\s*:/i.test(text);
  if (!looksLikeBlock) return null;

  let username: string | undefined;
  let vmid: number | undefined;
  let plan: string | undefined;
  let ip: string | undefined;
  let price: number | undefined;
  let expiresAt: Date | undefined;

  for (const line of lines) {
    const atOnly = line.match(/^@([a-zA-Z0-9_]{5,32})$/i);
    if (atOnly) {
      username = atOnly[1]!.toLowerCase();
      continue;
    }

    const kv = /^([^:]{1,40}):\s*(.+)$/.exec(line);
    if (!kv) continue;

    const key = kv[1]!.trim().toLowerCase().replace(/\s+/g, " ");
    const val = kv[2]!.trim();

    if (/^(user|username|клиент|client)$/.test(key)) {
      username = val.replace(/^@+/, "").toLowerCase();
      continue;
    }
    if (/^(id vm|vm id|vmid|vm|id)$/.test(key)) {
      const n = extractVmidToken(val);
      if (n) vmid = n;
      continue;
    }
    if (/^(tarif|tariff|plan|тариф|rate)$/.test(key)) {
      plan = normalizeAdminPlanName(val);
      continue;
    }
    if (/^(ip|ipv4)$/.test(key)) {
      ip = val;
      continue;
    }
    if (/^(price|цена|renewal|продление|cost)$/.test(key)) {
      try {
        price = parsePriceToken(val);
      } catch {
        /* ignore invalid optional price */
      }
      continue;
    }
    if (/^(date|expires|expiry|до|срок|expire)$/.test(key)) {
      try {
        expiresAt = parseFlexibleDate(val);
      } catch {
        /* ignore invalid optional date */
      }
    }
  }

  if (!vmid || !plan || !ip || !ipv4Re.test(ip)) return null;

  return { username, vmid, plan, ip, price, expiresAt };
}

/** VPS / Dedicated transfer: one-line, block paste, or | -separated. */
export function parseAdminHostTransferInput(raw: string): {
  ip: string;
  hostId: string;
  plan: string;
  price: number;
  expiresAt: Date;
  username?: string;
} {
  const block = tryParseAdminVpsServiceBlock(raw);
  if (block) {
    const planSpec = resolveVdsPlanSpec(block.plan);
    return {
      ip: block.ip,
      hostId: String(block.vmid),
      plan: planSpec?.name ?? block.plan,
      price: block.price ?? planSpec?.priceBulletproof ?? 0,
      expiresAt: block.expiresAt ?? defaultAdminVpsExpireDate(30),
      username: block.username,
    };
  }

  const parts = tokenizeLine(raw);
  if (parts.length < 5) {
    throw new AdminServiceInputError(
      "Нужно 5 полей: IP, VMID, тариф, цена, дата — или блоком:\n@user\nID vm: 230\nTarif: Mega 1\nIp: 45.74.7.131",
      "invalid_format"
    );
  }

  const dateRaw = parts[parts.length - 1];
  if (!looksLikeDateToken(dateRaw)) {
    throw new AdminServiceInputError(
      "Последнее поле — дата (22.05.26 или 31.12.2026)",
      "invalid_date"
    );
  }

  let expiresAt: Date;
  try {
    expiresAt = parseFlexibleDate(dateRaw);
  } catch {
    throw new AdminServiceInputError(
      "Неверная дата. Используйте DD.MM.YY (например 22.05.26)",
      "invalid_date"
    );
  }

  const price = parsePriceToken(parts[parts.length - 2]);
  const ip = parts[0].trim();
  if (!ipv4Re.test(ip)) {
    throw new AdminServiceInputError(
      `Неверный IP: ${ip}. Пример: 45.74.7.154`,
      "invalid_format"
    );
  }

  const hostId = parts[1].trim();
  if (!/^\d+$/.test(hostId)) {
    throw new AdminServiceInputError(
      "Второе поле — числовой ID (VMID / ServerID), например 998",
      "invalid_format"
    );
  }

  const plan = normalizeAdminPlanName(parts.slice(2, -2).join(" "));

  return { ip, hostId, plan, price, expiresAt };
}

/** CDN: domain/project, plan, expiry. */
export function parseAdminCdnTransferInput(raw: string): {
  domainName: string;
  plan: string;
  expiresAt: Date;
} {
  const parts = tokenizeLine(raw);
  if (parts.length < 2) {
    throw new AdminServiceInputError(
      "Укажите домен/проект и дату. Пример: cdn.example.com active 2026-12-31",
      "invalid_format"
    );
  }

  const last = parts[parts.length - 1];
  if (!looksLikeDateToken(last)) {
    throw new AdminServiceInputError(
      "Последнее поле — дата окончания",
      "invalid_date"
    );
  }

  let expiresAt: Date;
  try {
    expiresAt = parseFlexibleDate(last);
  } catch {
    throw new AdminServiceInputError("Неверная дата", "invalid_date");
  }

  const plan =
    parts.length >= 3 ? parts.slice(1, -1).join(" ").trim() || "active" : "active";
  const domainName = parts[0].trim();
  if (!domainName) {
    throw new AdminServiceInputError("Укажите домен или имя проекта", "invalid_format");
  }

  return { domainName, plan, expiresAt };
}
