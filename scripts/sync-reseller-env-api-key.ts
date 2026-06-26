/**
 * Sync RESELLER_API_KEYS_JSON plaintext into reseller_api_keys (fix env/DB mismatch).
 *
 * Usage:
 *   npx tsx scripts/sync-reseller-env-api-key.ts partner_a
 */

import "dotenv/config";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import ResellerApiKey, {
  ResellerApiKeyStatus,
  ResellerApiKeyType,
} from "../src/entities/ResellerApiKey.js";
import {
  registerRuntimeApiKey,
  reloadResellerAuthRuntime,
} from "../src/modules/reseller/services/reseller-auth-runtime.js";
import { sha256Hex } from "../src/modules/reseller/services/reseller-crypto.js";

const resellerId = (process.argv[2] ?? "").trim();

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
    console.error("Usage: npx tsx scripts/sync-reseller-env-api-key.ts <resellerId>");
    process.exit(1);
  }

  const apiKey = parseEnvKeys()[resellerId]?.trim();
  if (!apiKey || apiKey.length < 12) {
    console.error(`No API key for "${resellerId}" in RESELLER_API_KEYS_JSON`);
    process.exit(1);
  }

  const ds = await getAppDataSource();
  const repo = ds.getRepository(ResellerApiKey);
  let row = await repo.findOne({
    where: { resellerId, status: ResellerApiKeyStatus.Active },
    order: { id: "DESC" },
  });

  const hash = sha256Hex(apiKey);
  const prefix = apiKey.slice(0, 16);

  if (row) {
    row.keyHash = hash;
    row.keyPrefix = prefix;
    await repo.save(row);
    console.log(`Updated active key row #${row.id} for ${resellerId}`);
  } else {
    row = repo.create({
      resellerId,
      keyType: ResellerApiKeyType.Production,
      status: ResellerApiKeyStatus.Active,
      keyPrefix: prefix,
      keyHash: hash,
      rateLimitPerMinute: 120,
      scopes: ["services:read", "services:write"],
    });
    await repo.save(row);
    console.log(`Created active key row for ${resellerId}`);
  }

  registerRuntimeApiKey(resellerId, apiKey);
  await reloadResellerAuthRuntime(ds);

  console.log(`prefix: ${prefix}…`);
  console.log(`hash:   ${hash.slice(0, 16)}…`);
  console.log("\npm2 restart dior-host-bot");

  await closeDataSource();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
