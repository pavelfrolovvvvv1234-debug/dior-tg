/**
 * Assign an existing Proxmox VM to a Telegram user (admin import).
 *
 * Usage:
 *   npx tsx scripts/assign-vds-to-user.ts --username thejavasea --vmid 230 --plan "Mega 1" --ip 45.74.7.131 --apply
 *   npx tsx scripts/assign-vds-to-user.ts --telegram-id 123456789 --vmid 230 --plan "Mega 1" --ip 45.74.7.131 --apply
 */

import "dotenv/config";
import axios from "axios";
import { Api } from "grammy";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import { UserRepository } from "../src/infrastructure/db/repositories/UserRepository.js";
import User from "../src/entities/User.js";
import VirtualDedicatedServer from "../src/entities/VirtualDedicatedServer.js";
import { buildAdminImportedVdsRow } from "../src/shared/admin/create-admin-vds-row.js";
import { parseAdminHostTransferInput } from "../src/shared/admin/parse-managed-service-input.js";
import {
  findUserByInternalOrTelegramId,
  findUserByStoredTelegramUsername,
  normalizeTelegramUsername,
  resolveUserFromAdminLookup,
} from "../src/shared/users/admin-user-lookup.js";
import type { AppContext } from "../src/shared/types/context.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

async function resolveUserForAssign(input: {
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
  const ctx = {
    api,
    appDataSource: input.dataSource,
  } as AppContext;
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
    `Could not resolve @${normalizedUsername}. Pass --telegram-id or --user-id (admin panel → user → ID)`
  );
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

async function main(): Promise<void> {
  const isApply = process.argv.includes("--apply");
  const username = argValue("--username");
  const telegramIdRaw = argValue("--telegram-id");
  const userIdRaw = argValue("--user-id");
  const vmid = Number(argValue("--vmid"));
  const ip = argValue("--ip");
  const plan = argValue("--plan") ?? "Mega 1";
  const block = [
    username ? `@${username.replace(/^@+/, "")}` : "",
    `ID vm: ${vmid}`,
    `Tarif: ${plan}`,
    ip ? `Ip: ${ip}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (!Number.isFinite(vmid) || vmid <= 0 || !ip) {
    throw new Error("Required: --vmid and --ip (and --username, --telegram-id, or --user-id)");
  }

  const parsed = parseAdminHostTransferInput(block);
  const botToken = (process.env.BOT_TOKEN ?? "").trim();
  const ds = await getAppDataSource();
  const user = await resolveUserForAssign({
    dataSource: ds,
    username,
    telegramIdRaw,
    userIdRaw,
    botToken,
  });
  const vdsRepo = ds.getRepository(VirtualDedicatedServer);

  const existing = await vdsRepo.findOne({ where: { vdsId: vmid } });
  if (existing) {
    if (existing.targetUserId === user.id) {
      console.log(`Already assigned: VMID ${vmid} → user #${user.id} (@${username ?? telegramId})`);
      await closeDataSource();
      return;
    }
    throw new Error(`VMID ${vmid} already belongs to user #${existing.targetUserId}`);
  }

  const row = buildAdminImportedVdsRow({
    targetUserId: user.id,
    vmid,
    ip: parsed.ip,
    plan: parsed.plan,
    price: parsed.price,
    expiresAt: parsed.expiresAt,
  });

  console.log(
    `${isApply ? "APPLY" : "DRY-RUN"}: assign VMID ${vmid} (${parsed.plan}, ${parsed.ip}) → user #${user.id} tg ${user.telegramId}${user.telegramUsername ? ` @${user.telegramUsername}` : ""}`
  );
  console.log(
    `Specs: CPU ${row.cpuCount} · RAM ${row.ramSize}GB · Disk ${row.diskSize}GB · $${row.renewalPrice}/mo · until ${row.expireAt.toISOString().slice(0, 10)}`
  );

  if (isApply) {
    await vdsRepo.save(row);
    console.log(`Saved VDS db id #${row.id}`);
  } else {
    console.log("Re-run with --apply to write.");
  }

  await closeDataSource();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
