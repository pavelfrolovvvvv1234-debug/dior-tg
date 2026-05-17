import type { Bot } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { SessionData } from "../../shared/types/session.js";
import { Role } from "../../entities/User.js";
import { Logger } from "../../app/logger.js";
import { ensureSessionUser } from "../../shared/utils/session-user.js";
import { ReferralAnalyticsService, ReferralListService } from "../../modules/referrals/index.js";
import type { ReferralListFilter, ReferralListSort } from "../../modules/referrals/types.js";
import {
  ensureReferralCenter,
  buildRefereesListText,
  buildRefereesListKeyboard,
  buildDetailText,
  buildDetailKeyboard,
  buildSortMenuKeyboard,
  buildFilterMenuKeyboard,
  buildAdminTopAffiliatesText,
  buildAdminTopKeyboard,
} from "./referral-center-ui.js";
import { openReferralsOverview } from "./referrals-hub.js";
import { REFERRAL_LIST_PAGE_SIZE } from "../../modules/referrals/referral-list.service.js";

async function resolveTelegramLabel(
  ctx: AppContext,
  telegramId: number
): Promise<string | null> {
  try {
    const chat = await ctx.api.getChat(telegramId);
    if ("username" in chat && chat.username) return `@${chat.username}`;
    if ("first_name" in chat) {
      const name = [chat.first_name, "last_name" in chat ? chat.last_name : ""]
        .filter(Boolean)
        .join(" ");
      if (name) return name;
    }
  } catch {
    /* private or blocked */
  }
  return null;
}

export type RenderRefereesListOptions = {
  /** Grammy Menu messages cannot switch to plain InlineKeyboard — send a new message. */
  forceNewMessage?: boolean;
};

export async function renderRefereesList(
  ctx: AppContext,
  opts?: RenderRefereesListOptions
): Promise<void> {
  try {
    const hasUser = await ensureSessionUser(ctx);
    const session = (await ctx.session) as SessionData;
    if (!hasUser || !session?.main?.user?.id) {
      await ctx
        .reply(ctx.t("error-unknown", { error: "session" }), { parse_mode: "HTML" })
        .catch(() => {});
      return;
    }

    const st = ensureReferralCenter(session);
    const locale = session.main.locale === "en" ? "en" : "ru";
    const referrerId = st.adminReferrerId ?? session.main.user.id;
    const listSvc = new ReferralListService(ctx.appDataSource);

    let [{ items, total }, overview] = await Promise.all([
      listSvc.listReferees(referrerId, {
        page: st.page,
        sort: st.sort,
        filter: st.filter,
        searchQuery: st.searchQuery,
        resolveDisplay: (tid) => resolveTelegramLabel(ctx, tid),
      }),
      listSvc.getOverview(referrerId),
    ]);

    const maxPage = Math.max(0, Math.ceil(total / REFERRAL_LIST_PAGE_SIZE) - 1);
    if (st.page > maxPage) {
      st.page = maxPage;
      if (st.page > 0 || total > 0) {
        const retry = await listSvc.listReferees(referrerId, {
          page: st.page,
          sort: st.sort,
          filter: st.filter,
          searchQuery: st.searchQuery,
          resolveDisplay: (tid) => resolveTelegramLabel(ctx, tid),
        });
        items = retry.items;
        total = retry.total;
      }
    }

    const text = buildRefereesListText(ctx, overview, items, st, total, locale);
    const keyboard = buildRefereesListKeyboard(ctx, st, total, items);

    const messageOpts = {
      parse_mode: "HTML" as const,
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    };

    if (opts?.forceNewMessage) {
      await ctx.reply(text, messageOpts);
      return;
    }

    try {
      await ctx.editMessageText(text, messageOpts);
    } catch {
      await ctx.reply(text, messageOpts);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    Logger.error("[Referrals] renderRefereesList failed:", error);
    await ctx
      .reply(ctx.t("error-unknown", { error: msg.slice(0, 180) }), { parse_mode: "HTML" })
      .catch(() => {});
  }
}

export function registerReferralCenterHandlers(bot: Bot<AppContext>): void {
  bot.callbackQuery("ref:hub", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    await openReferralsOverview(ctx);
  });

  bot.callbackQuery("ref:list", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    st.page = 0;
    st.detailRefereeId = undefined;
    await renderRefereesList(ctx);
  });

  bot.callbackQuery(/^ref:page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    st.page = Number.parseInt(ctx.match[1], 10) || 0;
    await renderRefereesList(ctx);
  });

  bot.callbackQuery(/^ref:sort:(earnings|join|activity|spent)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    st.sort = ctx.match[1] as ReferralListSort;
    st.page = 0;
    await renderRefereesList(ctx);
  });

  bot.callbackQuery(/^ref:filter:(all|active|inactive|deposited)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    st.filter = ctx.match[1] as ReferralListFilter;
    st.page = 0;
    await renderRefereesList(ctx);
  });

  bot.callbackQuery("ref:sort-menu", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    await ctx.editMessageText(ctx.t("ref-sort-menu-title"), {
      parse_mode: "HTML",
      reply_markup: buildSortMenuKeyboard(ctx, st.sort),
    });
  });

  bot.callbackQuery("ref:filter-menu", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    await ctx.editMessageText(ctx.t("ref-filter-menu-title"), {
      parse_mode: "HTML",
      reply_markup: buildFilterMenuKeyboard(ctx, st.filter),
    });
  });

  bot.callbackQuery("ref:search", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    const st = ensureReferralCenter(session);
    st.awaitingSearch = true;
    await ctx.reply(ctx.t("ref-search-prompt"), { parse_mode: "HTML" });
  });

  bot.callbackQuery(/^ref:detail:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    try {
      const session = (await ctx.session) as SessionData;
      const locale = session.main.locale === "en" ? "en" : "ru";
      const refereeId = Number.parseInt(ctx.match[1], 10);
      const st = ensureReferralCenter(session);
      const referrerId = st.adminReferrerId ?? session.main.user.id;
      const detail = await new ReferralListService(ctx.appDataSource).getRefereeDetail(
        referrerId,
        refereeId,
        (tid) => resolveTelegramLabel(ctx, tid)
      );
      if (!detail) {
        await ctx.answerCallbackQuery(ctx.t("error-user-not-found").slice(0, 200)).catch(() => {});
        return;
      }
      ensureReferralCenter(session).detailRefereeId = refereeId;
      const text = buildDetailText(ctx, detail, locale);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildDetailKeyboard(ctx, refereeId),
      }).catch(() =>
        ctx.reply(text, {
          parse_mode: "HTML",
          reply_markup: buildDetailKeyboard(ctx, refereeId),
        })
      );
    } catch (error) {
      Logger.error("[Referrals] ref:detail failed:", error);
    }
  });

  bot.callbackQuery("ref:noop", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
  });

  bot.callbackQuery(/^refadm:referees:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
      return;
    }
    const referrerId = Number.parseInt(ctx.match[1], 10);
    const st = ensureReferralCenter(session);
    st.adminReferrerId = referrerId;
    st.page = 0;
    st.searchQuery = undefined;
    await renderRefereesList(ctx, { forceNewMessage: true });
  });

  bot.callbackQuery("refadm:top", async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = (await ctx.session) as SessionData;
    if (session.main.user.role !== Role.Admin && session.main.user.role !== Role.Moderator) {
      return;
    }
    const rows = await new ReferralAnalyticsService(ctx.appDataSource).getTopAffiliates(12);
    const text = buildAdminTopAffiliatesText(ctx, rows);
    await ctx.editMessageText(text, {
      parse_mode: "HTML",
      reply_markup: buildAdminTopKeyboard(ctx),
    }).catch(() =>
      ctx.reply(text, { parse_mode: "HTML", reply_markup: buildAdminTopKeyboard(ctx) })
    );
  });
}

/** Consume private text when user is searching referrals. */
export async function handleReferralSearchText(ctx: AppContext, raw: string): Promise<boolean> {
  const session = (await ctx.session) as SessionData;
  const st = session.other.referralCenter;
  if (!st?.awaitingSearch) return false;
  st.awaitingSearch = false;
  st.searchQuery = raw.trim() || undefined;
  st.page = 0;
  await renderRefereesList(ctx, { forceNewMessage: true });
  return true;
}
