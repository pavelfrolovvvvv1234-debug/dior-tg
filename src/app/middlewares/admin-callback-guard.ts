/**
 * Blocks admin/staff Telegram callbacks unless role is verified via DB or allowlist.
 *
 * @module app/middlewares/admin-callback-guard
 */

import type { Middleware } from "grammy";
import type { AppContext } from "../../shared/types/context.js";
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
] as const;

export function isStaffProtectedCallback(data: string): boolean {
  return STAFF_CALLBACK_PREFIXES.some((p) => data.startsWith(p) || data.includes(p));
}

export function adminCallbackGuardMiddleware(): Middleware<AppContext> {
  return async (ctx, next) => {
    const data = ctx.callbackQuery?.data;
    if (data && isStaffProtectedCallback(data)) {
      if (!(await requireStaffAccess(ctx))) {
        return;
      }
    }
    return next();
  };
}
