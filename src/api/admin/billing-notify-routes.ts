/**
 * Internal API: web billing → Telegram admin alerts.
 *
 * POST /api/admin/billing/notify
 * Header: X-Admin-API-Key (same as ADMIN_API_KEY)
 *
 * @module api/admin/billing-notify-routes
 */

import express, { type Request, type Response } from "express";
import type { Bot, Api, RawApi } from "grammy";
import { z } from "zod";
import { notifyAdminsAboutWebBillingCredit } from "../../helpers/notifier.js";

const notifyBodySchema = z.object({
  amount: z.coerce.number().positive(),
  customer: z.string().trim().min(1).max(320),
  provider: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(120).optional(),
  paymentUrl: z.string().trim().url().max(2000).optional(),
  locale: z.enum(["ru", "en"]).optional(),
});

export function createBillingNotifyRouter(deps: {
  getBot: () => Bot<any, Api<RawApi>> | null;
}) {
  const router = express.Router();

  router.post("/notify", async (req: Request, res: Response) => {
    const bot = deps.getBot();
    if (!bot) {
      res.status(503).json({ error: "Bot not ready" });
      return;
    }

    const parsed = notifyBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
      return;
    }

    const body = parsed.data;
    try {
      await notifyAdminsAboutWebBillingCredit(bot, {
        amount: body.amount,
        customer: body.customer,
        provider: body.provider ?? null,
        reference: body.reference ?? null,
        paymentUrl: body.paymentUrl ?? null,
        locale: body.locale ?? "en",
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
