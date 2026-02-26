/**
 * Domain nameserver update conversation.
 *
 * @module ui/conversations/domain-update-ns-conversation
 */

import type { AppConversation } from "../../shared/types/context.js";
import type { AppContext } from "../../shared/types/context.js";
import { AmperDomainService } from "../../domain/services/AmperDomainService.js";
import { DomainRepository } from "../../infrastructure/db/repositories/DomainRepository.js";
import { BillingService } from "../../domain/billing/BillingService.js";
import { UserRepository } from "../../infrastructure/db/repositories/UserRepository.js";
import { TopUpRepository } from "../../infrastructure/db/repositories/TopUpRepository.js";
import { AmperDomainsProvider } from "../../infrastructure/domains/AmperDomainsProvider.js";
import { Logger } from "../../app/logger.js";

/**
 * Domain nameserver update conversation.
 */
export async function domainUpdateNsConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  const session = await ctx.session;
  
  // Try to get domainId from callback query data or session
  let domainId: number | undefined;
  if (ctx.callbackQuery && "data" in ctx.callbackQuery) {
    const match = (ctx.callbackQuery.data ?? "").match(/^domain_update_ns_(\d+)$/);
    if (match) {
      domainId = parseInt(match[1]);
      session.other = session.other || {};
      (session.other as any).currentDomainId = domainId;
    }
  }
  
  if (!domainId) {
    domainId = (session.other as any)?.currentDomainId as number;
  }

  if (!domainId) {
    await ctx.reply(ctx.t("error-invalid-context"));
    return;
  }

  const apiBaseUrl = process.env.AMPER_API_BASE_URL?.trim();
  const apiToken = process.env.AMPER_API_TOKEN?.trim();
  if (!apiBaseUrl || !apiToken) {
    await ctx.reply(ctx.t("domain-api-not-configured"));
    return;
  }

  try {
    const domainRepo = new DomainRepository(ctx.appDataSource);
    const userRepo = new UserRepository(ctx.appDataSource);
    const topUpRepo = new TopUpRepository(ctx.appDataSource);
    const billingService = new BillingService(ctx.appDataSource, userRepo, topUpRepo);

    const config = {
      apiBaseUrl: process.env.AMPER_API_BASE_URL || "",
      apiToken: process.env.AMPER_API_TOKEN || "",
      timeoutMs: parseInt(process.env.AMPER_API_TIMEOUT_MS || "8000"),
      defaultNs1: process.env.DEFAULT_NS1,
      defaultNs2: process.env.DEFAULT_NS2,
    };

    const provider = new AmperDomainsProvider(config);
    const domainService = new AmperDomainService(
      ctx.appDataSource,
      domainRepo,
      billingService,
      provider
    );

    const domain = await domainService.getDomainById(domainId);

    if (domain.userId !== session.main.user.id) {
      await ctx.reply(ctx.t("error-access-denied"));
      return;
    }

    await ctx.reply(ctx.t("domain-update-ns-enter", {
      currentNs1: domain.ns1 || ctx.t("not-specified"),
      currentNs2: domain.ns2 || ctx.t("not-specified"),
    }), {
      parse_mode: "HTML",
    });

    const nsCtx = await conversation.waitFor("message:text");
    const nsText = nsCtx.message.text.trim();
    const nsParts = nsText.split(/[\s,]+/);

    if (nsParts.length < 2) {
      await ctx.reply(ctx.t("domain-invalid-ns-format"));
      return;
    }

    const ns1 = nsParts[0];
    const ns2 = nsParts[1];

    // Validate nameserver format
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(ns1) ||
        !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/i.test(ns2)) {
      await ctx.reply(ctx.t("domain-invalid-ns-format"));
      return;
    }

    try {
      await domainService.updateNameservers(domainId, ns1, ns2);
      await ctx.reply(ctx.t("domain-ns-updated", {
        domain: domain.domain,
        ns1,
        ns2,
      }), {
        parse_mode: "HTML",
      });
    } catch (error: any) {
      Logger.error(`Failed to update nameservers for domain ${domainId}:`, error);
      const msg = error?.message || String(error);
      await ctx.reply(ctx.t("error-unknown", { error: msg.slice(0, 300) }), {
        parse_mode: "HTML",
      });
    }
  } catch (error: any) {
    Logger.error("Domain update NS conversation error:", error);
    await ctx.reply(ctx.t("error-unknown", { error: error.message || "Unknown error" }));
  }
}
