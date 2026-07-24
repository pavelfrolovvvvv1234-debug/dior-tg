/**
 * Conversation: add a DNS record for an Amper-managed domain.
 *
 * @module ui/conversations/domain-add-dns-conversation
 */

import type { AppConversation, AppContext } from "../../shared/types/context.js";
import { Logger } from "../../app/logger.js";
import { ensureSessionUser } from "../../shared/utils/session-user.js";
import { createInitialOtherSession } from "../../shared/session-initial.js";
import { getAppDataSource } from "../../infrastructure/db/datasource.js";
import {
  createAmperDomainService,
  isAmperApiConfigured,
} from "../../helpers/create-amper-domain-service.js";
import {
  AMPER_DNS_RECORD_TYPES,
  type AmperDnsRecordType,
} from "../../infrastructure/domains/amper-dns-types.js";

const pendingDnsDomainByTelegramId = new Map<number, number>();

export function setPendingDomainDnsAdd(telegramId: number, domainId: number): void {
  pendingDnsDomainByTelegramId.set(telegramId, domainId);
}

function safeT(ctx: AppContext, key: string, vars?: Record<string, string | number>): string {
  const t = (ctx as any).t;
  if (typeof t === "function") return String(t(key, vars));
  return key;
}

function parseDnsType(raw: string): AmperDnsRecordType | null {
  const t = raw.trim().toUpperCase();
  return (AMPER_DNS_RECORD_TYPES as string[]).includes(t) ? (t as AmperDnsRecordType) : null;
}

/**
 * Add DNS record conversation.
 * Expects session.other.domains.pendingDnsType or first token in message.
 */
export async function domainAddDnsConversation(
  conversation: AppConversation,
  ctx: AppContext
) {
  const session = await ctx.session;
  if (session && !session.other) {
    (session as any).other = createInitialOtherSession();
  }
  if (session) {
    await ensureSessionUser(ctx);
  }
  const telegramId = Number(ctx.from?.id ?? ctx.chatId ?? 0);

  let domainId =
    (session?.other?.domains as any)?.expandedId ??
    (session?.other as any)?.currentDomainId ??
    (telegramId > 0 ? pendingDnsDomainByTelegramId.get(telegramId) : undefined);

  if (!domainId) {
    await ctx.reply(safeT(ctx, "error-invalid-context"));
    return;
  }

  if (!isAmperApiConfigured()) {
    await ctx.reply(safeT(ctx, "domain-api-not-configured"));
    return;
  }

  const pendingType = (session?.other?.domains as any)?.pendingDnsType as
    | AmperDnsRecordType
    | undefined;

  try {
    const dataSource = ctx.appDataSource ?? (await getAppDataSource());
    const domainService = createAmperDomainService(dataSource);
    const domain = await domainService.getDomainById(domainId);

    let currentUserId = session?.main?.user?.id ?? 0;
    if (!currentUserId && telegramId > 0) {
      const { UserRepository } = await import(
        "../../infrastructure/db/repositories/UserRepository.js"
      );
      const byTid = await new UserRepository(dataSource).findByTelegramId(telegramId);
      currentUserId = byTid?.id ?? 0;
    }
    if (!currentUserId || domain.userId !== currentUserId) {
      await ctx.reply(safeT(ctx, "error-access-denied"));
      return;
    }

    let type = pendingType ?? null;
    if (!type) {
      await ctx.reply(safeT(ctx, "domain-dns-add-enter-type"), { parse_mode: "HTML" });
      const typeCtx = await conversation.waitFor("message:text");
      type = parseDnsType(typeCtx.message.text);
      if (!type) {
        await ctx.reply(safeT(ctx, "domain-dns-invalid-type"));
        return;
      }
    }

    await ctx.reply(
      safeT(ctx, "domain-dns-add-enter", {
        type,
        domain: domain.domain,
      }),
      { parse_mode: "HTML" }
    );

    const inputCtx = await conversation.waitFor("message:text");
    const raw = inputCtx.message.text.trim();
    // Formats:
    // name value
    // name value priority (MX)
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await ctx.reply(safeT(ctx, "domain-dns-invalid-format"));
      return;
    }

    const name = parts[0]!;
    let value: string;
    let priority: number | undefined;

    if (type === "MX" && parts.length >= 3 && /^\d+$/.test(parts[1]!)) {
      priority = parseInt(parts[1]!, 10);
      value = parts.slice(2).join(" ");
    } else {
      value = parts.slice(1).join(" ");
      if (type === "MX" && parts.length >= 3 && /^\d+$/.test(parts[parts.length - 1]!)) {
        priority = parseInt(parts[parts.length - 1]!, 10);
        value = parts.slice(1, -1).join(" ");
      }
    }

    if (!value) {
      await ctx.reply(safeT(ctx, "domain-dns-invalid-format"));
      return;
    }

    try {
      await domainService.addDnsRecord(domainId, {
        type,
        name,
        value,
        priority,
      });
      if (telegramId > 0) pendingDnsDomainByTelegramId.delete(telegramId);
      if (session?.other?.domains) {
        (session.other.domains as any).pendingDnsType = undefined;
      }
      await ctx.reply(
        safeT(ctx, "domain-dns-added", {
          type,
          name,
          value,
          domain: domain.domain,
        }),
        { parse_mode: "HTML" }
      );
    } catch (error: any) {
      Logger.error(`Failed to add DNS for domain ${domainId}:`, error);
      await ctx.reply(
        safeT(ctx, "error-unknown", { error: String(error?.message || error).slice(0, 300) }),
        { parse_mode: "HTML" }
      );
    }
  } catch (error: any) {
    Logger.error("Domain add DNS conversation error:", error);
    await ctx.reply(safeT(ctx, "error-unknown", { error: error.message || "Unknown error" }));
  }
}
