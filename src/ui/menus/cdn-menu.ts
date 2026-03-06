/**
 * CDN / Site proxy menu and conversation.
 * Integrates with proxy-service Bot API (create proxy, list proxies).
 *
 * @module ui/menus/cdn-menu
 */

import { Menu } from "@grammyjs/menu";
import { InlineKeyboard } from "grammy";
import type { AppContext, AppConversation } from "../../shared/types/context";
import { isCdnEnabled } from "../../app/config";
import {
  cdnGetPrice,
  cdnCreateProxy,
  cdnListProxies,
} from "../../infrastructure/cdn/CdnClient";
import { showTopupForMissingAmount } from "../../helpers/deposit-money";
import { getAppDataSource } from "../../database";
import User from "../../entities/User";
import { createInitialOtherSession } from "../../shared/session-initial";

const DOMAIN_REGEX =
  /^(?!https?:\/\/)(?!www\.$)(?!.*\/$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

function isValidDomain(name: string): boolean {
  return DOMAIN_REGEX.test(name.trim());
}

function isValidTargetUrl(url: string): boolean {
  const u = url.trim();
  return u.startsWith("http://") || u.startsWith("https://");
}

export const cdnMenu = new Menu<AppContext>("cdn-menu")
  .text(
    (ctx) => ctx.t("button-cdn-add-proxy"),
    async (ctx) => {
      if (!isCdnEnabled()) {
        await ctx.reply(ctx.t("cdn-not-configured"), { parse_mode: "HTML" });
        return;
      }
      try {
        const session = (await ctx.session) as any;
        if (session && !session.other) (session as any).other = createInitialOtherSession();
        await ctx.conversation.enter("cdnAddProxyConversation");
      } catch (e: any) {
        const msg = e?.message ?? "Error";
        await ctx.reply(ctx.t("cdn-error", { error: msg }), { parse_mode: "HTML" }).catch(() => {});
      }
    }
  )
  .row()
  .text(
    (ctx) => ctx.t("button-cdn-my-proxies"),
    async (ctx) => {
      if (!isCdnEnabled()) {
        await ctx.reply(ctx.t("cdn-not-configured"), { parse_mode: "HTML" });
        return;
      }
      const telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId;
      if (telegramId == null) {
        await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
        return;
      }
      try {
        const list = await cdnListProxies(telegramId);
          if (list.length === 0) {
            await ctx.reply(ctx.t("cdn-my-proxies-empty"), { parse_mode: "HTML" });
            return;
          }
          const lines = list.map((p) =>
            ctx.t("cdn-proxy-item", {
              domain: p.domain_name,
              target: p.target_url || "—",
              status: p.lifecycle_status || p.status,
            })
          );
          await ctx.reply(
            `${ctx.t("cdn-my-proxies-list")}\n\n${lines.join("\n")}`,
            { parse_mode: "HTML" }
          );
      } catch (e: any) {
        await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Unknown" }), {
          parse_mode: "HTML",
        });
      }
    }
  )
  .row()
  .back(
    (ctx) => ctx.t("button-back"),
    async (ctx) => {
      const session = await ctx.session;
      if (!session) return;
      if (!session.other) (session as any).other = createInitialOtherSession();
      const fromManage = session.other?.cdn?.fromManage;
      if (fromManage) {
        const { manageSerivcesMenu } = await import("../../helpers/manage-services.js");
        await ctx.editMessageText(ctx.t("manage-services-header"), {
          parse_mode: "HTML",
          reply_markup: manageSerivcesMenu,
        });
      } else {
        const { servicesMenu } = await import("../../helpers/services-menu.js");
        await ctx.editMessageText(ctx.t("menu-service-for-buy-choose"), {
          parse_mode: "HTML",
          reply_markup: servicesMenu,
        });
      }
    }
  );

/**
 * Conversation: add CDN proxy — domain → target URL → confirm → pay → create.
 */
function ensureCdnSession(session: any): void {
  if (!session) return;
  if (!session.other) (session as any).other = createInitialOtherSession();
  if (!session.other!.cdn) session.other!.cdn = { step: "idle" };
}

export async function cdnAddProxyConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  let session = (await ctx.session) as any;
  if (!session) {
    await ctx.reply(ctx.t("cdn-error", { error: "Session not ready. Try again." }), {
      parse_mode: "HTML",
    });
    return;
  }
  ensureCdnSession(session);
  const telegramId = ctx.from?.id ?? ctx.loadedUser?.telegramId;
  if (telegramId == null) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    return;
  }
  session.other.cdn.telegramId = telegramId;

  await ctx.reply(ctx.t("cdn-enter-domain"), { parse_mode: "HTML" });

  const domainCtx = await conversation.waitFor("message:text");
  session = (await (domainCtx as any).session) as any;
  ensureCdnSession(session);
  const domainName = domainCtx.message.text?.trim() ?? "";

  if (!domainName) {
    await ctx.reply(ctx.t("cdn-invalid-domain"));
    return;
  }
  if (!isValidDomain(domainName)) {
    await ctx.reply(ctx.t("cdn-invalid-domain"));
    return;
  }

  session.other.cdn.domainName = domainName;
  await ctx.reply(ctx.t("cdn-enter-target"), { parse_mode: "HTML" });

  const targetCtx = await conversation.waitFor("message:text");
  session = (await (targetCtx as any).session) as any;
  ensureCdnSession(session);
  const targetUrl = targetCtx.message.text?.trim() ?? "";

  if (!targetUrl || !isValidTargetUrl(targetUrl)) {
    await ctx.reply(ctx.t("cdn-invalid-url"));
    return;
  }

  session.other.cdn.targetUrl = targetUrl;

  let price: number;
  try {
    price = await cdnGetPrice();
  } catch (e: any) {
    await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Failed to get price" }), {
      parse_mode: "HTML",
    });
    return;
  }

  session.other.cdn.price = price;

  const keyboard = new InlineKeyboard()
    .text(ctx.t("button-cdn-confirm"), "cdn_confirm")
    .text(ctx.t("button-cdn-cancel"), "cdn_cancel");

  await ctx.reply(
    ctx.t("cdn-confirm", {
      domainName: session.other.cdn.domainName,
      targetUrl: session.other.cdn.targetUrl!,
      price: session.other.cdn.price,
    }),
    { parse_mode: "HTML", reply_markup: keyboard }
  );

  const confirmCtx = await conversation.waitForCallbackQuery(/^cdn_(confirm|cancel)$/);
  session = (await (confirmCtx as any).session) as any;
  ensureCdnSession(session);
  if (!confirmCtx.callbackQuery?.data) {
    return;
  }
  if (confirmCtx.callbackQuery.data === "cdn_cancel") {
    await confirmCtx.answerCallbackQuery();
    await confirmCtx.reply(ctx.t("button-back"));
    session.other.cdn = { step: "idle" };
    return;
  }

  if (confirmCtx.callbackQuery.data !== "cdn_confirm") {
    return;
  }

  await confirmCtx.answerCallbackQuery();

  const dataSource = await getAppDataSource();
  const userRepo = dataSource.getRepository(User);
  const userId = session?.main?.user?.id;
  if (!userId) {
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }
  const user = await userRepo.findOneBy({ id: userId });
  if (!user || user.balance < price) {
    await showTopupForMissingAmount(ctx, price - (user?.balance ?? 0));
    session.other.cdn = { step: "idle" };
    return;
  }

  user.balance -= price;
  await userRepo.save(user);
  session.main.user.balance = user.balance;

  const tid = session.other.cdn.telegramId ?? confirmCtx.from?.id ?? ctx.loadedUser?.telegramId;
  if (tid == null) {
    user.balance += price;
    await userRepo.save(user);
    session.main.user.balance = user.balance;
    await ctx.reply(ctx.t("cdn-error", { error: "User not found" }), { parse_mode: "HTML" });
    session.other.cdn = { step: "idle" };
    return;
  }

  try {
    const result = await cdnCreateProxy({
      telegramId: tid,
      username: ctx.from?.username,
      domainName: session.other.cdn.domainName!,
      targetUrl: session.other.cdn.targetUrl!,
      forceHttps: true,
      hostHeader: "incoming",
      cachingEnabled: false,
    });

    if (!result.success) {
      user.balance += price;
      await userRepo.save(user);
      session.main.user.balance = user.balance;
      await ctx.reply(ctx.t("cdn-error", { error: result.error ?? "Create failed" }), {
        parse_mode: "HTML",
      });
      session.other.cdn = { step: "idle" };
      return;
    }

    await ctx.reply(
      ctx.t("cdn-created", {
        domainName: session.other.cdn.domainName!,
        targetUrl: session.other.cdn.targetUrl!,
      }),
      { parse_mode: "HTML" }
    );
  } catch (e: any) {
    user.balance += price;
    await userRepo.save(user);
    session.main.user.balance = user.balance;
    await ctx.reply(ctx.t("cdn-error", { error: e?.message ?? "Request failed" }), {
      parse_mode: "HTML",
    });
  }

  session.other.cdn = { step: "idle" };
}
