/**
 * Re-send staff alerts for open provisioning tickets (e.g. after fixing STAFF_NOTIFY_CHAT_ID).
 *
 * Usage:
 *   npx tsx scripts/resend-provisioning-staff-alerts.ts
 *   npx tsx scripts/resend-provisioning-staff-alerts.ts --ticket-id 34
 *   npx tsx scripts/resend-provisioning-staff-alerts.ts --apply
 */
import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import { getAppDataSource, closeDataSource } from "../src/infrastructure/db/datasource.js";
import ProvisioningTicket, {
  ProvisioningTicketStatus,
} from "../src/entities/ProvisioningTicket.js";
import DedicatedServerOrder from "../src/entities/DedicatedServerOrder.js";
import { notifyStaffChats } from "../src/helpers/notifier.js";
import { initFluent } from "../src/fluent.js";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1]?.trim();
}

const normalizeI18nText = (value: string): string =>
  value.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const ticketIdRaw = argValue("--ticket-id");
  const ticketId = ticketIdRaw ? Number(ticketIdRaw) : null;

  const token = process.env.BOT_TOKEN?.trim();
  if (!token) {
    console.error("BOT_TOKEN missing in .env");
    process.exit(1);
  }

  const ds = await getAppDataSource();
  const { fluent } = await initFluent();
  const t = (key: string, vars: Record<string, string | number>) =>
    normalizeI18nText(String(fluent.translate("ru", key, vars)));

  const openStatuses = [
    ProvisioningTicketStatus.OPEN,
    ProvisioningTicketStatus.IN_PROGRESS,
    ProvisioningTicketStatus.WAITING,
  ];

  const tickets = await ds.getRepository(ProvisioningTicket).find({
    where: ticketId != null ? { id: ticketId } : undefined,
    order: { id: "DESC" },
    take: ticketId != null ? 1 : 50,
  });

  const pending = tickets.filter((tk) => openStatuses.includes(tk.status as ProvisioningTicketStatus));
  if (pending.length === 0) {
    console.log("No matching open provisioning tickets.");
    await closeDataSource();
    return;
  }

  const bot = new Bot(token);
  let sent = 0;

  for (const ticket of pending) {
    const order = await ds.getRepository(DedicatedServerOrder).findOneBy({ id: ticket.orderId });
    if (!order) {
      console.warn(`Ticket #${ticket.id}: order #${ticket.orderId} not found, skip`);
      continue;
    }

    const text = t("provisioning-staff-notification", {
      ticketId: ticket.id,
      orderId: order.id,
      userId: order.userId,
      amount: order.paymentAmount,
      serviceName: order.productName,
      location: order.locationLabel ?? order.locationKey ?? "N/A",
      os: order.osLabel ?? order.osKey ?? "N/A",
    });
    const keyboard = new InlineKeyboard()
      .text("Открыть", `prov_view_${ticket.id}`)
      .text("Закрыть", `ticket_notify_close_${ticket.id}`);

    console.log(
      `[${apply ? "SEND" : "DRY"}] ticket #${ticket.id} order #${order.id} — ${order.productName} (${order.locationLabel})`
    );

    if (apply) {
      await notifyStaffChats(bot.api, ds, {
        text,
        replyMarkup: keyboard,
        contextLabel: `resend provisioning ticket #${ticket.id}`,
      });
      sent++;
    }
  }

  console.log(apply ? `Done. Alerts sent for ${sent} ticket(s).` : "Dry run. Pass --apply to send.");
  await closeDataSource();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
