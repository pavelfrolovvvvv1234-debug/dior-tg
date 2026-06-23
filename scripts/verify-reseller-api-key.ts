/**
 * Verify reseller API key matches DB + runtime, then test localhost API.
 *
 * Usage:
 *   npx tsx scripts/verify-reseller-api-key.ts partner_a
 *   npx tsx scripts/verify-reseller-api-key.ts partner_a rh_live_xxx...
 */

import "dotenv/config";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import ResellerApiKey, { ResellerApiKeyStatus } from "../src/entities/ResellerApiKey.js";
import {
  getResellerAuthRuntime,
  reloadResellerAuthRuntime,
} from "../src/modules/reseller/services/reseller-auth-runtime.js";
import { resolveResellerIdByApiKey, sha256Hex } from "../src/modules/reseller/services/reseller-crypto.js";

const resellerId = (process.argv[2] ?? "").trim();
const explicitKey = (process.argv[3] ?? "").trim();

function parseEnvKeys(): Record<string, string> {
  const raw = process.env.RESELLER_API_KEYS_JSON?.trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  if (!resellerId) {
    console.error("Usage: npx tsx scripts/verify-reseller-api-key.ts <resellerId> [apiKey]");
    process.exit(1);
  }

  const envKeys = parseEnvKeys();
  const apiKey = explicitKey || envKeys[resellerId]?.trim() || "";

  console.log(`\n=== Verify API key: ${resellerId} ===\n`);
  console.log(`Key source: ${explicitKey ? "argument" : envKeys[resellerId] ? "RESELLER_API_KEYS_JSON" : "MISSING"}`);
  console.log(`Key length: ${apiKey.length}`);
  console.log(`Key prefix: ${apiKey.slice(0, 16) || "(empty)"}…`);

  if (!apiKey) {
    console.error("\nNo API key. Set RESELLER_API_KEYS_JSON or pass as 2nd argument.");
    process.exit(1);
  }

  const ds = await getAppDataSource();
  const row = await ds.getRepository(ResellerApiKey).findOne({
    where: { resellerId, status: ResellerApiKeyStatus.Active },
    order: { id: "DESC" },
  });

  const computedHash = sha256Hex(apiKey);
  console.log(`\nComputed sha256: ${computedHash.slice(0, 16)}…`);

  if (row) {
    console.log(`DB keyHash:      ${row.keyHash.slice(0, 16)}…`);
    console.log(`DB keyPrefix:    ${row.keyPrefix}…`);
    if (row.keyHash === computedHash) {
      console.log("\n✓ Env/arg key MATCHES database keyHash");
    } else {
      console.log("\n✗ MISMATCH — .env key is NOT the active API key in DB.");
      console.log("  Fix: Admin → Resellers → partner_a → Rotate API key");
      console.log("  Then update RESELLER_API_KEYS_JSON in .env and pm2 restart dior-host-bot");
    }
  } else {
    console.log("\nNo active API key row in DB for this reseller.");
  }

  await reloadResellerAuthRuntime(ds);
  const runtime = getResellerAuthRuntime();
  const resolved = resolveResellerIdByApiKey(apiKey);
  console.log(`\nRuntime lookup: ${resolved ?? "NOT FOUND (invalid_api_key)"}`);
  console.log(`api-key-only: ${runtime.apiKeyOnly[resellerId] ? "yes" : "no"}`);
  console.log(`loaded key hashes: ${Object.keys(runtime.keysByHash).length}`);

  const port = process.env.RESELLER_API_PORT ?? "3003";
  const url = `http://127.0.0.1:${port}/reseller/v1/services`;
  console.log(`\nLocal curl: ${url}`);

  try {
    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    const text = await res.text();
    console.log(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  } catch (e) {
    console.error("Local fetch failed (is reseller API listening?):", e);
  }

  await closeDataSource();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
