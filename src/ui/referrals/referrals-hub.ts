/**
 * Shared referral overview opener (profile + callbacks).
 */

import type { InlineKeyboard } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { SessionData } from "../../shared/types/session.js";
import User from "../../entities/User.js";
import { ReferralService } from "../../domain/referral/ReferralService.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { ReferralListService } from "../../modules/referrals/referral-list.service.js";
import { tierBadgeEmoji } from "../../modules/referrals/referral-tier.js";
export async function openReferralsOverview(ctx: AppContext): Promise<void> {
  const { referralsMenu } = await import("../menus/referrals-menu.js");
  const session = (await ctx.session) as SessionData;
  const referralService = new ReferralService(
    ctx.appDataSource,
    new UserRepository(ctx.appDataSource)
  );
  const listSvc = new ReferralListService(ctx.appDataSource);
  const referrerId = session.main.user.id;

  const [link, overview] = await Promise.all([
    referralService.getReferralLink(referrerId),
    listSvc.getOverview(referrerId),
  ]);

  const userForRef = await ctx.appDataSource.manager.findOne(User, {
    where: { id: referrerId },
    select: ["referralBalance"],
  });
  const refBalance = userForRef?.referralBalance ?? session.main.user.referralBalance ?? 0;

  const tierEmoji = tierBadgeEmoji(overview.tier);
  const lastJoin = overview.lastReferralJoinedAt
    ? overview.lastReferralJoinedAt.toLocaleDateString(
        session.main.locale === "en" ? "en-US" : "ru-RU",
        { month: "short", day: "numeric" }
      )
    : "—";

  const text = ctx
    .t("referrals-screen-premium", {
      link,
      tier: overview.tier.toUpperCase(),
      tierEmoji,
      totalReferees: overview.totalReferees,
      activeReferees: overview.activeReferees,
      totalEarned: overview.totalEarned.toFixed(2),
      pendingPayout: overview.pendingPayout.toFixed(2),
      conversionRate: overview.conversionRate.toFixed(1),
      referralPercent: overview.referralPercent,
      earned7d: overview.earned7d.toFixed(2),
      earned30d: overview.earned30d.toFixed(2),
      profit: refBalance.toFixed(2),
      lastJoin,
    })
    .replace(/\\n/g, "\n");

  await ctx.editMessageText(text, {
    parse_mode: "HTML",
    reply_markup: referralsMenu,
    link_preview_options: { is_disabled: true },
  }).catch(async () => {
    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: referralsMenu,
      link_preview_options: { is_disabled: true },
    });
  });
}
