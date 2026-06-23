/**
 * Diagnose reseller API setup for a partner id (e.g. lapd_k).
 *
 * Usage: npx tsx scripts/diagnose-reseller.ts lapd_k
 */

import "dotenv/config";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import Reseller from "../src/entities/Reseller.js";
import ResellerApiKey, { ResellerApiKeyStatus } from "../src/entities/ResellerApiKey.js";
import User from "../src/entities/User.js";
import VirtualDedicatedServer from "../src/entities/VirtualDedicatedServer.js";
import { Not, IsNull } from "typeorm";
import { reloadResellerAuthRuntime } from "../src/modules/reseller/services/reseller-auth-runtime.js";
import { sha256Hex } from "../src/modules/reseller/services/reseller-crypto.js";

const resellerId = (process.argv[2] ?? "").trim();
if (!resellerId) {
  console.error("Usage: npx tsx scripts/diagnose-reseller.ts <resellerId>");
  process.exit(1);
}

function parseEnvJson(name: string): Record<string, string> {
  const raw = process.env[name]?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  const ds = await getAppDataSource();
  const repo = ds.getRepository(Reseller);
  const reseller = await repo.findOne({ where: { id: resellerId } });

  console.log(`\n=== Reseller diagnose: ${resellerId} ===\n`);

  const vdsCount = await ds.getRepository(VirtualDedicatedServer).count({
    where: { resellerId },
  });
  console.log(`VPS tagged resellerId: ${vdsCount}`);

  if (!reseller) {
    console.log("DB profile: MISSING (legacy — only VPS tags)");
    console.log("Fix: Admin → Resellers → open id → Create API profile");
    console.log("  or: npx tsx scripts/ensure-reseller.ts", resellerId, "<telegram_username>");
  } else {
    console.log("DB profile: OK");
    console.log(`  status: ${reseller.status}`);
    console.log(`  telegram: @${reseller.telegramUsername ?? "—"} id=${reseller.telegramId ?? "—"}`);
    console.log(`  signing in DB: ${reseller.apiSigningSecret?.trim() ? "yes" : "NO"}`);
  }

  const keys = await ds.getRepository(ResellerApiKey).find({
    where: { resellerId, status: ResellerApiKeyStatus.Active },
  });
  console.log(`Active API keys: ${keys.length}`);
  for (const k of keys) {
    console.log(`  prefix ${k.keyPrefix}…`);
  }

  const envKeys = parseEnvJson("RESELLER_API_KEYS_JSON");
  const envSigning = parseEnvJson("RESELLER_API_SIGNING_SECRETS_JSON");
  const envIps = parseEnvJson("RESELLER_API_ALLOWED_IPS_JSON");

  if (envKeys[resellerId]) {
    console.log(`Env RESELLER_API_KEYS_JSON: set (hash ${sha256Hex(envKeys[resellerId]).slice(0, 12)}…)`);
  } else {
    console.log("Env RESELLER_API_KEYS_JSON: not set for this id");
  }
  if (envSigning[resellerId]) {
    console.log("Env RESELLER_API_SIGNING_SECRETS_JSON: set");
  } else {
    console.log("Env RESELLER_API_SIGNING_SECRETS_JSON: not set for this id");
  }
  if (envIps[resellerId]) {
    console.log(`IP allowlist: ${envIps[resellerId]}`);
  } else if (reseller?.ipWhitelist?.length) {
    console.log(`IP allowlist (DB): ${reseller.ipWhitelist.join(", ")}`);
  } else {
    console.log("IP allowlist: none");
  }

  const runtime = await reloadResellerAuthRuntime(ds);
  const hasSigning = Boolean(runtime.signingSecrets[resellerId]);
  const keyHashes = Object.entries(runtime.keysByHash)
    .filter(([, rid]) => rid === resellerId)
    .map(([h]) => h.slice(0, 12));
  console.log(`\nRuntime after reload:`);
  console.log(`  signing loaded: ${hasSigning ? "yes" : "NO — API returns hmac_signing_required_for_reseller"}`);
  console.log(`  key hashes: ${keyHashes.length ? keyHashes.join(", ") + "…" : "none"}`);

  if (reseller?.telegramId) {
    const user = await ds.getRepository(User).findOneBy({ telegramId: reseller.telegramId });
    console.log(`\nBilling wallet: ${user ? `$${user.balance.toFixed(2)}` : "user row missing"}`);
  }

  console.log("\nCommon client error missing_signature_headers = only x-api-key sent.");
  console.log("Partner fix: add x-timestamp, x-nonce, x-signature (HMAC). GET signs \"<ts>.\"");
  console.log("Partner can run /reseller_api in bot if telegram is linked.\n");

  await closeDataSource();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
