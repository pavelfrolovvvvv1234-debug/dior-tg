/**
 * Assign registered Amper/manual domains to a Telegram user (admin import).
 *
 * Usage:
 *   npx tsx scripts/assign-domains-to-user.ts --username UnitedGlobe --apply
 *   npx tsx scripts/assign-domains-to-user.ts --telegram-id 123456789 --apply
 *   npx tsx scripts/assign-domains-to-user.ts --username UnitedGlobe --force-reassign --apply
 */

import "dotenv/config";
import axios from "axios";
import { Api } from "grammy";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import { UserRepository } from "../src/infrastructure/db/repositories/UserRepository.js";
import { DomainRepository } from "../src/infrastructure/db/repositories/DomainRepository.js";
import { BillingService } from "../src/domain/billing/BillingService.js";
import { TopUpRepository } from "../src/infrastructure/db/repositories/TopUpRepository.js";
import { AmperDomainService } from "../src/domain/services/AmperDomainService.js";
import { AmperDomainsProvider } from "../src/infrastructure/domains/AmperDomainsProvider.js";
import Domain, { DomainStatus } from "../src/entities/Domain.js";
import User from "../src/entities/User.js";
import { parseFlexibleDate } from "../src/modules/admin/manual-services/schemas.js";
import {
  findUserByInternalOrTelegramId,
  findUserByStoredTelegramUsername,
  normalizeTelegramUsername,
  persistTelegramUsernameIfChanged,
  resolveUserFromAdminLookup,
} from "../src/shared/users/admin-user-lookup.js";
import type { AppContext } from "../src/shared/types/context.js";

/** Punycode in DB; display label for logs only. */
const DEFAULT_DOMAINS = [
  { fqdn: "xn--whd-lwb.net", display: "whɵd.net", expiresAt: "14.04.27" },
  { fqdn: "xn--whe-xqa.net", display: "wheđ.net", expiresAt: "08.04.27" },
  { fqdn: "xn--whd-1na.net", display: "whød.net", expiresAt: "23.04.27" },
  { fqdn: "vvhed.net", display: "vvhed.net", expiresAt: "06.05.27" },
] as const;

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

function splitFqdn(fqdn: string): { domain: string; tld: string } {
  const lastDot = fqdn.lastIndexOf(".");
  if (lastDot <= 0) throw new Error(`Invalid fqdn: ${fqdn}`);
  return { domain: fqdn, tld: fqdn.slice(lastDot + 1) };
}

async function resolveTelegramIdViaApi(username: string, botToken: string): Promise<number | null> {
  const normalized = username.replace(/^@+/, "").trim();
  if (!normalized) return null;
  try {
    const { data } = await axios.get(`https://api.telegram.org/bot${botToken}/getChat`, {
      params: { chat_id: `@${normalized}` },
      timeout: 15000,
    });
    if (data?.ok && typeof data?.result?.id === "number") {
      return Number(data.result.id);
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function resolveUser(input: {
  dataSource: Awaited<ReturnType<typeof getAppDataSource>>;
  username?: string;
  telegramIdRaw?: string;
  userIdRaw?: string;
  botToken: string;
}): Promise<User> {
  if (input.userIdRaw) {
    const user = await findUserByInternalOrTelegramId(input.dataSource, input.userIdRaw);
    if (user) return user;
    throw new Error(`User not found for --user-id ${input.userIdRaw}`);
  }

  if (input.telegramIdRaw) {
    const telegramId = Number(input.telegramIdRaw);
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      throw new Error(`Invalid --telegram-id: ${input.telegramIdRaw}`);
    }
    const userRepo = new UserRepository(input.dataSource);
    return userRepo.findOrCreateByTelegramId(telegramId);
  }

  const normalizedUsername = normalizeTelegramUsername(input.username);
  if (!normalizedUsername) {
    throw new Error("Pass --username, --telegram-id, or --user-id");
  }

  const fromDb = await findUserByStoredTelegramUsername(input.dataSource, normalizedUsername);
  if (fromDb) return fromDb;

  if (!input.botToken) {
    throw new Error(
      `User @${normalizedUsername} not in DB. Set BOT_TOKEN or pass --telegram-id / --user-id`
    );
  }

  const api = new Api(input.botToken);
  const ctx = { api, appDataSource: input.dataSource } as AppContext;
  const fromLookup = await resolveUserFromAdminLookup(ctx, normalizedUsername, {
    maxUsernameScan: 2500,
  });
  if (fromLookup) return fromLookup;

  const byTelegramId = await resolveTelegramIdViaApi(normalizedUsername, input.botToken);
  if (byTelegramId != null) {
    const userRepo = new UserRepository(input.dataSource);
    return userRepo.findOrCreateByTelegramId(byTelegramId);
  }

  throw new Error(
    `Could not resolve @${normalizedUsername}. Pass --telegram-id or --user-id`
  );
}

async function upsertDomainForUser(input: {
  dataSource: Awaited<ReturnType<typeof getAppDataSource>>;
  user: User;
  fqdn: string;
  display: string;
  expiresAt: string;
  forceReassign: boolean;
  isApply: boolean;
  amperService: AmperDomainService;
}): Promise<void> {
  const normalized = input.fqdn.toLowerCase();
  const expireDate = parseFlexibleDate(input.expiresAt);
  const domainRepo = input.dataSource.getRepository(Domain);

  const owned = await domainRepo.findOne({
    where: { userId: input.user.id, domain: normalized },
  });
  if (owned) {
    console.log(`  ✓ already on user: ${normalized} (${input.display})`);
    return;
  }

  const global = await domainRepo.findOne({ where: { domain: normalized } });
  if (global && global.userId !== input.user.id) {
    if (!input.forceReassign) {
      throw new Error(
        `Domain ${normalized} belongs to user #${global.userId}. Re-run with --force-reassign to move.`
      );
    }
    console.log(`  ↪ reassign ${normalized} from user #${global.userId} → #${input.user.id}`);
    if (input.isApply) {
      global.userId = input.user.id;
      global.lastSyncAt = expireDate;
      await domainRepo.save(global);
    }
    return;
  }

  if (input.isApply) {
    const imported = await input.amperService.importDomainFromAmper(
      input.user.id,
      normalized,
      input.user.telegramId
    );
    if (imported) {
      imported.lastSyncAt = expireDate;
      await domainRepo.save(imported);
      console.log(
        `  → imported ${normalized} (${input.display}) id #${imported.id}${imported.providerDomainId ? ` amper:${imported.providerDomainId}` : ""}`
      );
      return;
    }
  } else {
    console.log(`  → would import/create ${normalized} (${input.display}) until ${input.expiresAt}`);
    return;
  }

  const { tld } = splitFqdn(normalized);
  const row = domainRepo.create({
    userId: input.user.id,
    domain: normalized,
    tld,
    period: 1,
    price: 0,
    status: DomainStatus.REGISTERED,
    ns1: null,
    ns2: null,
    provider: "amper",
    providerDomainId: null,
    lastSyncAt: expireDate,
    bundleType: null,
  });
  const saved = await domainRepo.save(row);
  console.log(`  → created stub ${normalized} (${input.display}) id #${saved.id}`);
}

async function main(): Promise<void> {
  const isApply = process.argv.includes("--apply");
  const forceReassign = process.argv.includes("--force-reassign");
  const username = argValue("--username");
  const telegramIdRaw = argValue("--telegram-id");
  const userIdRaw = argValue("--user-id");
  const botToken = (process.env.BOT_TOKEN ?? "").trim();

  const ds = await getAppDataSource();
  const user = await resolveUser({
    dataSource: ds,
    username,
    telegramIdRaw,
    userIdRaw,
    botToken,
  });

  const normalizedUsername = normalizeTelegramUsername(username);
  if (normalizedUsername && isApply) {
    await persistTelegramUsernameIfChanged(ds, user.id, normalizedUsername);
  }

  const domainRepo = new DomainRepository(ds);
  const userRepo = new UserRepository(ds);
  const topUpRepo = new TopUpRepository(ds);
  const billing = new BillingService(ds, userRepo, topUpRepo);
  const provider = new AmperDomainsProvider({
    apiBaseUrl: process.env.AMPER_API_BASE_URL || "",
    apiToken: process.env.AMPER_API_TOKEN || "",
    timeoutMs: Number.parseInt(process.env.AMPER_API_TIMEOUT_MS || "8000", 10),
    defaultNs1: process.env.DEFAULT_NS1,
    defaultNs2: process.env.DEFAULT_NS2,
  });
  const amperService = new AmperDomainService(ds, domainRepo, billing, provider);

  console.log(
    `${isApply ? "APPLY" : "DRY-RUN"}: assign ${DEFAULT_DOMAINS.length} domains → user #${user.id} tg ${user.telegramId}${
      user.telegramUsername ? ` @${user.telegramUsername}` : normalizedUsername ? ` @${normalizedUsername}` : ""
    }\n`
  );

  for (const dom of DEFAULT_DOMAINS) {
    console.log(`Domain ${dom.fqdn} (${dom.display}) until ${dom.expiresAt}`);
    await upsertDomainForUser({
      dataSource: ds,
      user,
      fqdn: dom.fqdn,
      display: dom.display,
      expiresAt: dom.expiresAt,
      forceReassign,
      isApply,
      amperService,
    });
  }

  await closeDataSource();
  console.log(isApply ? "\nDone. Client should see domains in «Мои услуги → Домены»." : "\nDry-run. Re-run with --apply to write.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
