/**
 * Staff/admin guards: callbacks, commands, and sensitive session text modes.
 *
 * @module app/middlewares/staff-guards
 */

import type { Middleware } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
import type { OtherSessionData } from "../../shared/types/session.js";
import { requireAdmin } from "../../shared/auth/permissions.js";
import { requireStaffAccess } from "../../shared/auth/staff-access.js";

const STAFF_CALLBACK_PREFIXES = [
  "admin-",
  "admin:",
  "advcs:",
  "ars-",
  "control-user",
  "control-users",
  "mod-ticket",
  "ticket-admin",
  "mod-",
  "ticket-mod",
  "broadcast_",
  "broadcast-confirm",
  "promo-admin",
  "reseller-admin",
  "prov_",
  "moderator-",
  "cu-",
  "users-page",
] as const;

/** Callbacks that require admin (not moderator). */
const ADMIN_CALLBACK_PREFIXES = ["broadcast_", "ars-", "advcs:"] as const;

const ADMIN_ONLY_COMMANDS = new Set([
  "admin",
  "broadcast",
  "send",
  "promote_link",
  "create_promo",
  "promo_codes",
  "remove_promo",
]);

const STAFF_COMMANDS = new Set([
  "domainrequests",
  "approve_domain",
  "reject_domain",
  "showvds",
  "removevds",
  "users",
  "tickets",
  "ticket",
]);

export function isStaffProtectedCallback(data: string): boolean {
  if (STAFF_CALLBACK_PREFIXES.some((p) => data.startsWith(p))) {
    return true;
  }
  if (data.includes("control-user") || data.includes("admin-user")) {
    return true;
  }
  return false;
}

function parseCommandName(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const head = t.split(/\s+/)[0] ?? "";
  const name = head.includes("@") ? head.split("@")[0]! : head;
  return name.slice(1).toLowerCase() || null;
}

export function otherSessionRequiresAdmin(other: OtherSessionData): boolean {
  return !!(
    other.balanceEdit ||
    other.subscriptionEdit ||
    (other.broadcast && other.broadcast.step !== "idle") ||
    other.adminVds?.awaitingSearch ||
    other.adminVds?.awaitingTransferUserId ||
    other.adminCdn?.awaitingSearch ||
    other.resellerOnboard ||
    other.adminCreateService ||
    other.promoAdmin?.createStep ||
    other.promoAdmin?.editStep ||
    other.promoAdmin?.editingPromoId
  );
}

export function otherSessionRequiresStaff(other: OtherSessionData): boolean {
  if (otherSessionRequiresAdmin(other)) return true;
  return !!(
    other.messageToUser ||
    other.controlUsersPage?.awaitingUserLookup ||
    other.referralPercentEdit ||
    other.adminDomainNs ||
    other.adminDomainSetAmperId ||
    other.adminRegisterDomain ||
    other.ticketsView?.pendingAction ||
    other.ticketsView?.currentTicketId
  );
}

function clearSensitiveAdminSession(other: OtherSessionData): void {
  delete other.balanceEdit;
  delete other.messageToUser;
  delete other.subscriptionEdit;
  delete other.referralPercentEdit;
  delete other.adminDomainNs;
  delete other.adminDomainSetAmperId;
  delete other.adminRegisterDomain;
  if (other.broadcast) other.broadcast = { step: "idle" };
  if (other.controlUsersPage) other.controlUsersPage.awaitingUserLookup = false;
  if (other.adminVds) {
    other.adminVds.awaitingSearch = false;
    other.adminVds.awaitingTransferUserId = false;
  }
  if (other.adminCdn) other.adminCdn.awaitingSearch = false;
  if (other.ticketsView) {
    other.ticketsView.pendingAction = null;
    other.ticketsView.pendingTicketId = null;
  }
}

export function adminCallbackGuardMiddleware(): Middleware<AppContext> {
  return async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    if (!data || !isStaffProtectedCallback(data)) {
      return next();
    }
    const needsAdmin = ADMIN_CALLBACK_PREFIXES.some((p) => data.startsWith(p));
    if (needsAdmin) {
      if (!(await requireAdmin(ctx))) return;
    } else if (!(await requireStaffAccess(ctx))) {
      return;
    }
    return next();
  };
}

export function staffCommandGuardMiddleware(): Middleware<AppContext> {
  return async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text) return next();

    const cmd = parseCommandName(text);
    if (!cmd) return next();

    if (ADMIN_ONLY_COMMANDS.has(cmd)) {
      if (!(await requireAdmin(ctx))) return;
    } else if (STAFF_COMMANDS.has(cmd)) {
      if (!(await requireStaffAccess(ctx))) return;
    }

    return next();
  };
}

/** Blocks text input in admin/staff session modes without DB-verified role. */
export function staffSensitiveInputMiddleware(): Middleware<AppContext> {
  return async (ctx, next) => {
    if (!ctx.message?.text || ctx.message.text.startsWith("/")) {
      return next();
    }

    const session = await ctx.session;
    const other = session?.other;
    if (!other) return next();

    if (!otherSessionRequiresStaff(other)) {
      return next();
    }

    if (otherSessionRequiresAdmin(other)) {
      if (!(await requireAdmin(ctx))) {
        clearSensitiveAdminSession(other);
        return;
      }
    } else if (!(await requireStaffAccess(ctx))) {
      clearSensitiveAdminSession(other);
      return;
    }

    return next();
  };
}
