/**
 * Smart retarget before VDS deletion: Day 1 (existing), Day 2: «+5% действует ещё 24ч», Day 3: «Последний шанс продлить без потери данных».
 * Called from ExpirationService daily check when VDS is in grace (payDayAt set).
 *
 * @module modules/growth/campaigns/grace-retarget.campaign
 */

import { getOffer, setOffer } from "../storage.js";
import { canSendCommercialPush, markCommercialPushSent } from "./commercial-limiter.js";
import { Logger } from "../../../app/logger.js";
import type { GrowthSendMessageFn } from "./send-message.js";
import { getAppDataSource } from "../../../infrastructure/db/datasource.js";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import User from "../../../entities/User.js";
import { buildVdsExpirationKeyboard } from "../../../shared/vds-expiration-ui.js";

const GRACE_DAY2_KEY = "growth_grace_day2:";
const GRACE_DAY3_KEY = "growth_grace_day3:";
const GRACE_DAY2_TTL = 2 * 24 * 60 * 60; // 2 days
const GRACE_DAY3_TTL = 1 * 24 * 60 * 60; // 1 day

const MESSAGE_DAY2_KEY = "vds-grace-day2";
const MESSAGE_DAY3_KEY = "vds-grace-day3";

/**
 * Get hours until payDayAt (deletion date).
 */
function hoursUntilPayDay(payDayAt: Date): number {
  return (new Date(payDayAt).getTime() - Date.now()) / (60 * 60 * 1000);
}

async function loadGraceKeyboard(
  vdsId: number,
  userId: number,
  locale: string,
  translate: (locale: string, key: string) => string
) {
  const dataSource = await getAppDataSource();
  const [vds, user] = await Promise.all([
    dataSource.getRepository(VirtualDedicatedServer).findOneBy({ id: vdsId }),
    dataSource.getRepository(User).findOneBy({ id: userId }),
  ]);
  if (!vds || !user) {
    return buildVdsExpirationKeyboard(translate, locale, {
      vdsId,
      userBalance: 0,
      renewalPrice: vds?.renewalPrice ?? 0,
      autoRenewOn: true,
    });
  }
  return buildVdsExpirationKeyboard(translate, locale, {
    vdsId: vds.id,
    userBalance: user.balance,
    renewalPrice: vds.renewalPrice,
    autoRenewOn: vds.autoRenewEnabled !== false,
  });
}

/**
 * Send Day 2 or Day 3 reminder if applicable. Returns true if a message was sent.
 */
export async function maybeSendGraceDay2OrDay3(
  vdsId: number,
  userId: number,
  telegramId: number,
  payDayAt: Date,
  locale: string,
  sendMessage: GrowthSendMessageFn,
  translate: (locale: string, key: string) => string
): Promise<boolean> {
  const graceButtons = await loadGraceKeyboard(vdsId, userId, locale, translate);
  const hoursLeft = hoursUntilPayDay(payDayAt);
  if (hoursLeft > 48) return false; // Day 2 not yet
  if (hoursLeft <= 0) return false;

  try {
    if (hoursLeft <= 24) {
      const key3 = `${GRACE_DAY3_KEY}${vdsId}`;
      if (!(await getOffer(key3))) {
        if (await canSendCommercialPush(userId)) {
          await sendMessage(telegramId, translate(locale, MESSAGE_DAY3_KEY), {
            replyMarkup: graceButtons,
          });
          await setOffer(key3, "1", GRACE_DAY3_TTL);
          await markCommercialPushSent(userId);
          return true;
        }
      }
    } else {
      const key2 = `${GRACE_DAY2_KEY}${vdsId}`;
      if (!(await getOffer(key2))) {
        if (await canSendCommercialPush(userId)) {
          await sendMessage(telegramId, translate(locale, MESSAGE_DAY2_KEY), {
            replyMarkup: graceButtons,
          });
          await setOffer(key2, "1", GRACE_DAY2_TTL);
          await markCommercialPushSent(userId);
          return true;
        }
      }
    }
  } catch (e) {
    Logger.error(`[Growth] Grace day2/day3 for VDS ${vdsId} failed`, e);
  }
  return false;
}
