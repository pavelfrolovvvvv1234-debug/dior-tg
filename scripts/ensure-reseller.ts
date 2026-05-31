/**
 * Create or restore a reseller record (admin panel + API billing).
 *
 * Usage:
 *   npx tsx scripts/ensure-reseller.ts <resellerId> <telegramUsername>
 *
 * Example:
 *   npx tsx scripts/ensure-reseller.ts partner_a lapd_k
 *
 * Reads optional RESELLER_API_KEYS_JSON / RESELLER_API_SIGNING_SECRETS_JSON for this id.
 */

import "dotenv/config";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import Reseller, { ResellerPlan, ResellerStatus } from "../src/entities/Reseller.js";
import ResellerApiKey, {
  ResellerApiKeyStatus,
  ResellerApiKeyType,
} from "../src/entities/ResellerApiKey.js";
import User, { Role, UserStatus } from "../src/entities/User.js";
import { RESELLER_PLAN_LIMITS } from "../src/modules/reseller/domain/reseller-plans.js";
import {
  generateApiKeyPair,
  generateReferralCode,
  generateSigningSecret,
  generateWebhookSecret,
  sha256Hex,
} from "../src/modules/reseller/services/reseller-crypto.js";
import {
  registerRuntimeApiKey,
  registerRuntimeSigningSecret,
  reloadResellerAuthRuntime,
} from "../src/modules/reseller/services/reseller-auth-runtime.js";

const resellerId = (process.argv[2] ?? "").trim();
const telegramUsername = (process.argv[3] ?? "").trim().replace(/^@/, "").toLowerCase();

if (!resellerId || !telegramUsername) {
  console.error("Usage: npx tsx scripts/ensure-reseller.ts <resellerId> <telegramUsername>");
  console.error("Example: npx tsx scripts/ensure-reseller.ts partner_a lapd_k");
  process.exit(1);
}

function parseEnvJson(name: string): Record<string, string> {
  const raw = process.env[name]?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (k.trim() && v != null) out[k.trim()] = String(v).trim();
    }
    return out;
  } catch {
    console.warn(`[ensure-reseller] Could not parse ${name}`);
    return {};
  }
}

async function findUserByUsername(dataSource: Awaited<ReturnType<typeof getAppDataSource>>, username: string) {
  const repo = dataSource.getRepository(User);
  let user = await repo.findOne({ where: { telegramUsername: username } });
  if (user) return user;
  const rows = await repo
    .createQueryBuilder("u")
    .where("LOWER(u.telegramUsername) = LOWER(:username)", { username })
    .getMany();
  return rows[0] ?? null;
}

async function ensureApiKey(
  dataSource: Awaited<ReturnType<typeof getAppDataSource>>,
  id: string,
  envApiKey: string | undefined,
  rateLimit: number
): Promise<string> {
  const keyRepo = dataSource.getRepository(ResellerApiKey);
  const active = await keyRepo.findOne({
    where: { resellerId: id, status: ResellerApiKeyStatus.Active },
  });
  if (active) {
    console.log(`[ensure-reseller] Active API key already exists (prefix ${active.keyPrefix}…)`);
    return envApiKey ?? "(stored in DB — use admin Rotate key to reveal)";
  }

  let publicKey: string;
  let prefix: string;
  let hash: string;

  if (envApiKey && envApiKey.length >= 12) {
    publicKey = envApiKey;
    prefix = publicKey.slice(0, 16);
    hash = sha256Hex(publicKey);
    console.log("[ensure-reseller] Using API key from RESELLER_API_KEYS_JSON");
  } else {
    const pair = generateApiKeyPair();
    publicKey = pair.publicKey;
    prefix = pair.prefix;
    hash = pair.hash;
    console.log("[ensure-reseller] Generated new API key (save it — shown once below)");
  }

  const row = keyRepo.create({
    resellerId: id,
    keyType: ResellerApiKeyType.Production,
    status: ResellerApiKeyStatus.Active,
    keyPrefix: prefix,
    keyHash: hash,
    rateLimitPerMinute: rateLimit,
    scopes: ["services:read", "services:write"],
  });
  await keyRepo.save(row);
  registerRuntimeApiKey(id, publicKey);
  return publicKey;
}

async function main(): Promise<void> {
  const dataSource = await getAppDataSource();
  const repo = dataSource.getRepository(Reseller);
  const limits = RESELLER_PLAN_LIMITS[ResellerPlan.Starter];

  const envKeys = parseEnvJson("RESELLER_API_KEYS_JSON");
  const envSigning = parseEnvJson("RESELLER_API_SIGNING_SECRETS_JSON");

  const botUser = await findUserByUsername(dataSource, telegramUsername);
  if (!botUser) {
    console.warn(
      `[ensure-reseller] User @${telegramUsername} not in DB yet — reseller will be created, but billing works after /start in bot`
    );
  }

  let reseller = await repo.findOne({ where: { id: resellerId } });
  const signingFromEnv = envSigning[resellerId];
  const signing = signingFromEnv && signingFromEnv.length >= 12
    ? { raw: signingFromEnv, hash: sha256Hex(signingFromEnv) }
    : generateSigningSecret();
  const webhook = generateWebhookSecret();

  if (reseller) {
    console.log(`[ensure-reseller] Updating existing reseller "${resellerId}"`);
    reseller.telegramUsername = telegramUsername;
    if (botUser) reseller.telegramId = botUser.telegramId;
    reseller.displayName = reseller.displayName ?? `@${telegramUsername}`;
    reseller.status = ResellerStatus.Active;
    if (!reseller.apiSigningSecret?.trim()) {
      reseller.apiSigningSecret = signing.raw;
      reseller.signingSecretHash = signing.hash;
    }
    if (!reseller.referralCode) {
      reseller.referralCode = generateReferralCode(resellerId);
    }
    await repo.save(reseller);
  } else {
    console.log(`[ensure-reseller] Creating reseller "${resellerId}"`);
    reseller = repo.create({
      id: resellerId,
      displayName: `@${telegramUsername}`,
      telegramId: botUser?.telegramId ?? null,
      telegramUsername,
      email: null,
      company: null,
      status: ResellerStatus.Active,
      plan: ResellerPlan.Starter,
      profitPercent: limits.profitPercent,
      maxVps: limits.maxVps,
      apiRatePerMinute: limits.apiRatePerMinute,
      referralCode: generateReferralCode(resellerId),
      signingSecretHash: signing.hash,
      apiSigningSecret: signing.raw,
      webhookSecretHash: webhook.hash,
      webhookSigningSecret: webhook.raw,
      ipWhitelist: [],
      lastActivityAt: new Date(),
    });
    await repo.save(reseller);
  }

  if (botUser && !botUser.telegramUsername) {
    botUser.telegramUsername = telegramUsername;
    await dataSource.getRepository(User).save(botUser);
  }

  const apiKey = await ensureApiKey(
    dataSource,
    resellerId,
    envKeys[resellerId],
    reseller.apiRatePerMinute || limits.apiRatePerMinute
  );

  if (signingFromEnv) {
    registerRuntimeSigningSecret(resellerId, signingFromEnv);
  } else if (reseller.apiSigningSecret) {
    registerRuntimeSigningSecret(resellerId, reseller.apiSigningSecret);
  }

  await reloadResellerAuthRuntime(dataSource);

  console.log("\n=== Reseller ready ===");
  console.log(`ID:       ${resellerId}`);
  console.log(`Telegram: @${telegramUsername}${botUser ? ` (id ${botUser.telegramId}, balance $${botUser.balance})` : " — needs /start in bot"}`);
  console.log(`Status:   ${reseller.status}`);
  if (apiKey.startsWith("rh_")) {
    console.log(`API key:  ${apiKey}`);
  }
  console.log(`Signing:  ${reseller.apiSigningSecret ?? signing.raw}`);
  console.log("\nRestart bot to reload API runtime: pm2 restart dior-host-bot");

  await closeDataSource();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
