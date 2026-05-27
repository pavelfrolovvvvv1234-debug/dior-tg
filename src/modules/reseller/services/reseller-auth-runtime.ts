import type { DataSource } from "typeorm";
import Reseller, { ResellerStatus } from "../../../entities/Reseller.js";
import { sha256Hex } from "./reseller-crypto.js";

export type ResellerAuthRuntimeMaps = {
  keysByResellerId: Record<string, string>;
  keysByHash: Record<string, string>;
  signingSecrets: Record<string, string>;
  allowedIps: Record<string, string[]>;
  webhooks: Record<string, string>;
  webhookSecrets: Record<string, string>;
  rateLimitPerMinute: Record<string, number>;
};

let cache: ResellerAuthRuntimeMaps | null = null;

const pendingRuntime: ResellerAuthRuntimeMaps = {
  keysByResellerId: {},
  keysByHash: {},
  signingSecrets: {},
  allowedIps: {},
  webhooks: {},
  webhookSecrets: {},
  rateLimitPerMinute: {},
};

function parseJsonRecord(raw: string | undefined): Record<string, unknown> {
  const source = (raw ?? "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function mergeEnvMaps(base: ResellerAuthRuntimeMaps): ResellerAuthRuntimeMaps {
  const out: ResellerAuthRuntimeMaps = {
    keysByResellerId: { ...base.keysByResellerId },
    keysByHash: { ...base.keysByHash },
    signingSecrets: { ...base.signingSecrets },
    allowedIps: { ...base.allowedIps },
    webhooks: { ...base.webhooks },
    webhookSecrets: { ...base.webhookSecrets },
    rateLimitPerMinute: { ...base.rateLimitPerMinute },
  };

  const keysParsed = parseJsonRecord(process.env.RESELLER_API_KEYS_JSON);
  for (const [resellerId, keyValue] of Object.entries(keysParsed)) {
    const key = String(keyValue ?? "").trim();
    if (resellerId.trim() && key.length >= 12) {
      const rid = resellerId.trim();
      out.keysByResellerId[rid] = key;
      out.keysByHash[sha256Hex(key)] = rid;
    }
  }

  const signingParsed = parseJsonRecord(process.env.RESELLER_API_SIGNING_SECRETS_JSON);
  for (const [resellerId, secret] of Object.entries(signingParsed)) {
    const s = String(secret ?? "").trim();
    if (resellerId.trim() && s.length >= 12) out.signingSecrets[resellerId.trim()] = s;
  }

  const ipsParsed = parseJsonRecord(process.env.RESELLER_API_ALLOWED_IPS_JSON);
  for (const [resellerId, value] of Object.entries(ipsParsed)) {
    const rid = resellerId.trim();
    if (!rid) continue;
    if (Array.isArray(value)) {
      out.allowedIps[rid] = value.map((x) => String(x).trim()).filter(Boolean);
    } else if (typeof value === "string") {
      out.allowedIps[rid] = value.split(",").map((x) => x.trim()).filter(Boolean);
    }
  }

  const whParsed = parseJsonRecord(process.env.RESELLER_WEBHOOKS_JSON);
  for (const [resellerId, url] of Object.entries(whParsed)) {
    const u = String(url ?? "").trim();
    if (resellerId.trim() && u) out.webhooks[resellerId.trim()] = u;
  }

  const whSecParsed = parseJsonRecord(process.env.RESELLER_WEBHOOK_SECRETS_JSON);
  for (const [resellerId, secret] of Object.entries(whSecParsed)) {
    const s = String(secret ?? "").trim();
    if (resellerId.trim() && s) out.webhookSecrets[resellerId.trim()] = s;
  }

  return out;
}

export function registerRuntimeApiKey(resellerId: string, apiKey: string): void {
  pendingRuntime.keysByResellerId[resellerId] = apiKey;
  pendingRuntime.keysByHash[sha256Hex(apiKey)] = resellerId;
}

export function registerRuntimeSigningSecret(resellerId: string, secret: string): void {
  pendingRuntime.signingSecrets[resellerId] = secret;
}

export function registerRuntimeWebhookSecret(resellerId: string, secret: string): void {
  pendingRuntime.webhookSecrets[resellerId] = secret;
}

export async function reloadResellerAuthRuntime(dataSource: DataSource): Promise<ResellerAuthRuntimeMaps> {
  const maps: ResellerAuthRuntimeMaps = {
    keysByResellerId: { ...pendingRuntime.keysByResellerId },
    keysByHash: { ...pendingRuntime.keysByHash },
    signingSecrets: { ...pendingRuntime.signingSecrets },
    allowedIps: { ...pendingRuntime.allowedIps },
    webhooks: { ...pendingRuntime.webhooks },
    webhookSecrets: { ...pendingRuntime.webhookSecrets },
    rateLimitPerMinute: { ...pendingRuntime.rateLimitPerMinute },
  };

  const resellers = await dataSource.getRepository(Reseller).find();
  for (const r of resellers) {
    if (r.status !== ResellerStatus.Active && r.status !== ResellerStatus.Pending) continue;
    if (r.webhookUrl) maps.webhooks[r.id] = r.webhookUrl;
    if (r.ipWhitelist?.length) maps.allowedIps[r.id] = r.ipWhitelist;
    if (r.apiRatePerMinute > 0) maps.rateLimitPerMinute[r.id] = r.apiRatePerMinute;
  }

  cache = mergeEnvMaps(maps);
  return cache;
}

export function getResellerAuthRuntime(): ResellerAuthRuntimeMaps {
  if (cache) return cache;
  return mergeEnvMaps({
    keysByResellerId: { ...pendingRuntime.keysByResellerId },
    keysByHash: { ...pendingRuntime.keysByHash },
    signingSecrets: { ...pendingRuntime.signingSecrets },
    allowedIps: { ...pendingRuntime.allowedIps },
    webhooks: { ...pendingRuntime.webhooks },
    webhookSecrets: { ...pendingRuntime.webhookSecrets },
    rateLimitPerMinute: { ...pendingRuntime.rateLimitPerMinute },
  });
}

export function resolveResellerIdByApiKey(apiKey: string): string | null {
  const maps = getResellerAuthRuntime();
  return maps.keysByHash[sha256Hex(apiKey)] ?? null;
}
