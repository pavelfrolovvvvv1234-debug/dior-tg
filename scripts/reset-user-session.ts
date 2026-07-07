/**
 * Delete Grammy session files for one user (unstick bot UI).
 *
 * Usage:
 *   npx tsx scripts/reset-user-session.ts --telegram-id 1074705220
 *   npx tsx scripts/reset-user-session.ts --username mr_mekanike
 */
import fs from "fs";
import path from "path";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

function deleteSessionKey(dir: string, key: string): boolean {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) return false;
  const direct = path.join(resolved, key);
  if (fs.existsSync(direct)) {
    fs.unlinkSync(direct);
    return true;
  }
  const prefix = `${key}-`;
  let removed = false;
  for (const name of fs.readdirSync(resolved)) {
    if (name === key || name.startsWith(prefix)) {
      fs.unlinkSync(path.join(resolved, name));
      removed = true;
    }
  }
  return removed;
}

async function main(): Promise<void> {
  const telegramId = argValue("--telegram-id");
  const username = argValue("--username");
  if (!telegramId && !username) {
    console.error("Pass --telegram-id ID or --username name");
    process.exit(1);
  }

  let key = telegramId ?? "";
  if (!key && username) {
    const { getAppDataSource, closeDataSource } = await import("../src/infrastructure/db/datasource.js");
    const { findUserByStoredTelegramUsername, normalizeTelegramUsername } = await import(
      "../src/shared/users/admin-user-lookup.js"
    );
    const ds = await getAppDataSource();
    const user = await findUserByStoredTelegramUsername(
      ds.manager,
      normalizeTelegramUsername(username)
    );
    await closeDataSource();
    if (!user) {
      console.error(`User @${username} not found in DB`);
      process.exit(1);
    }
    key = String(user.telegramId);
    console.log(`Resolved @${username} -> telegramId=${key} userId=${user.id}`);
  }

  const roots = ["sessions/main", "sessions/other", "sessions/conversations"];
  let any = false;
  for (const dir of roots) {
    const removed = deleteSessionKey(dir, key);
    if (removed) {
      any = true;
      console.log(`Removed session file(s) in ${dir} for ${key}`);
    }
  }
  if (!any) {
    console.log(`No session files found for ${key} (already clean or never chatted)`);
  } else {
    console.log("Done. Ask the user to send /start again.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
