/**
 * Clear referrerId for a user (admin).
 *
 * Usage:
 *   npx tsx scripts/unbind-referrer.ts --username diorhost --apply
 *   npx tsx scripts/unbind-referrer.ts --user-id 123 --expected-referrer-id 350 --apply
 */
import "dotenv/config";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import User from "../src/entities/User.js";
import {
  findUserByInternalOrTelegramId,
  findUserByStoredTelegramUsername,
  normalizeTelegramUsername,
} from "../src/shared/users/admin-user-lookup.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const username = argValue("--username");
  const userIdRaw = argValue("--user-id");
  const telegramIdRaw = argValue("--telegram-id");
  const expectedReferrerId = argValue("--expected-referrer-id");

  if (!username && !userIdRaw && !telegramIdRaw) {
    console.error("Provide --username, --user-id, or --telegram-id");
    process.exit(1);
  }

  const ds = await getAppDataSource();
  const repo = ds.getRepository(User);

  let user: User | null = null;
  if (userIdRaw) {
    user = await findUserByInternalOrTelegramId(ds, userIdRaw);
  } else if (telegramIdRaw) {
    user = await findUserByInternalOrTelegramId(ds, telegramIdRaw);
  } else if (username) {
    const norm = normalizeTelegramUsername(username);
    if (!norm) {
      console.error(`Invalid username: ${username}`);
      process.exit(1);
    }
    user = await findUserByStoredTelegramUsername(ds, norm);
  }

  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  const referrer =
    user.referrerId != null
      ? await repo.findOne({ where: { id: user.referrerId } })
      : null;

  console.log(
    JSON.stringify(
      {
        apply,
        user: {
          id: user.id,
          telegramId: user.telegramId,
          telegramUsername: user.telegramUsername,
          referrerId: user.referrerId,
        },
        referrer: referrer
          ? {
              id: referrer.id,
              telegramId: referrer.telegramId,
              telegramUsername: referrer.telegramUsername,
            }
          : null,
      },
      null,
      2
    )
  );

  if (user.referrerId == null) {
    console.log("Already unbound — nothing to do.");
    await closeDataSource();
    return;
  }

  if (expectedReferrerId) {
    const expected = Number.parseInt(expectedReferrerId, 10);
    if (user.referrerId !== expected) {
      console.error(
        `Referee referrerId is ${user.referrerId}, expected ${expected} — aborting`
      );
      process.exit(2);
    }
  }

  if (!apply) {
    console.log("Dry-run. Pass --apply to set referrerId = NULL.");
    await closeDataSource();
    return;
  }

  await repo.update(user.id, { referrerId: null });
  console.log(`OK: user #${user.id} referrer cleared`);
  await closeDataSource();
}

main().catch(async (error) => {
  console.error(error);
  await closeDataSource().catch(() => {});
  process.exit(1);
});
