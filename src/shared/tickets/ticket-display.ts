import type { AppContext } from "../types/context.js";

/** Localized public-facing support team label (Поддержка / Support). */
export function ticketSupportLabel(ctx: Pick<AppContext, "t">): string {
  return ctx.t("ticket-support-label");
}

/** Assignee/responsible line in ticket cards — never expose staff personal emails. */
export function formatTicketAssigneeDisplay(
  ctx: Pick<AppContext, "t">,
  assigneeUserId: number | null | undefined
): string {
  if (assigneeUserId == null) {
    return ctx.t("ticket-card-responsible-none");
  }
  return ticketSupportLabel(ctx);
}
