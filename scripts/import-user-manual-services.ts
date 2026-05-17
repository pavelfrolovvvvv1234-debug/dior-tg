/**
 * Import dedicated + domain services for a user (admin migration).
 *
 * Usage:
 *   npx tsx scripts/import-user-manual-services.ts [telegramId] [--apply]
 *
 * Without --apply: dry-run only. telegramId skips @username lookup via Bot API.
 */

import "dotenv/config";
import axios from "axios";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import { UserRepository } from "../src/infrastructure/db/repositories/UserRepository.js";
import { AdminManualServiceService } from "../src/modules/admin/manual-services/admin-manual-service.service.js";
import { generateManualServicePassword } from "../src/modules/admin/manual-services/admin-manual-service.service.js";

const TARGET_USERNAME = "hellopando133";

function parseCliNumber(flag: string): number | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  const n = Number(process.argv[i + 1]);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function parseCliTelegramId(): number | undefined {
  const fromFlag = parseCliNumber("--telegram-id");
  if (fromFlag) return fromFlag;
  const arg = process.argv.find((a) => /^\d{8,}$/.test(a));
  if (!arg) return undefined;
  return Number(arg);
}

const DEDICATED = [
  {
    externalId: 222,
    ipv4: "45.74.7.40",
    monthlyPrice: 200,
    paidUntil: "29.05.26",
  },
  {
    externalId: 226,
    ipv4: "45.74.7.180",
    monthlyPrice: 200,
    paidUntil: "29.05.26",
  },
] as const;

/** Use punycode / ASCII fqdn in DB. */
const DOMAINS = [
  { fqdn: "xn--whd-lwb.net", display: "whɵd.net", price: 450, expiresAt: "14.04.27" },
  { fqdn: "xn--whe-xqa.net", display: "wheđ.net", price: 450, expiresAt: "08.04.27" },
  { fqdn: "xn--whd-1na.net", display: "whød.net", price: 450, expiresAt: "23.04.27" },
  { fqdn: "vvhed.net", display: "vvhed.net", price: 300, expiresAt: "06.05.27" },
] as const;

async function resolveTelegramId(username: string, botToken: string): Promise<number | null> {
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

async function main(): Promise<void> {
  const isApply = process.argv.includes("--apply");
  const botToken = (process.env.BOT_TOKEN ?? "").trim();
  const cliTid = parseCliTelegramId();

  let telegramId: number | null = cliTid ?? null;
  if (!telegramId && botToken) {
    telegramId = await resolveTelegramId(TARGET_USERNAME, botToken);
  }

  if (!telegramId) {
    throw new Error(
      `Could not resolve @${TARGET_USERNAME}. Pass numeric telegram id: npx tsx scripts/import-user-manual-services.ts <telegramId> --apply`
    );
  }

  const ds = await getAppDataSource();
  const userRepo = new UserRepository(ds);
  const userDbId = parseCliNumber("--user-id");
  const user = userDbId
    ? await userRepo.findById(userDbId)
    : await userRepo.findOrCreateByTelegramId(telegramId);
  if (!user) {
    throw new Error(`User not found (db id ${userDbId})`);
  }
  const svc = new AdminManualServiceService(ds);

  console.log(
    `${isApply ? "APPLY" : "DRY-RUN"}: user #${user.id} @${TARGET_USERNAME} (tg ${telegramId})\n`
  );

  for (const d of DEDICATED) {
    const draft = {
      ipv4: d.ipv4,
      provider: "Dior Host",
      login: "root",
      password: generateManualServicePassword(),
      rackLocation: "—",
      hardwareInfo: `Imported dedicated · external ID ${d.externalId}`,
      monthlyPrice: d.monthlyPrice,
      paidUntil: d.paidUntil,
      notes: `External service ID ${d.externalId}`,
    };
    console.log(`Dedicated ${d.externalId} ${d.ipv4} $${d.monthlyPrice}/mo until ${d.paidUntil}`);
    if (isApply) {
      const result = await svc.createDedicated(user.id, draft);
      console.log(`  → ${result.summary}`);
    }
  }

  for (const dom of DOMAINS) {
    const draft = {
      domain: dom.fqdn,
      registrar: "manual-import",
      expiresAt: dom.expiresAt,
      notes: `display:${dom.display} · price:$${dom.price}/yr`,
    };
    console.log(`Domain ${dom.fqdn} (${dom.display}) $${dom.price} until ${dom.expiresAt}`);
    if (isApply) {
      try {
        const result = await svc.createDomain(user.id, draft);
        console.log(`  → ${result.summary}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("already exists")) {
          console.log(`  → skip: ${msg}`);
        } else {
          throw e;
        }
      }
    }
  }

  await closeDataSource();
  console.log(isApply ? "\nDone." : "\nDry-run complete. Re-run with --apply to write.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
