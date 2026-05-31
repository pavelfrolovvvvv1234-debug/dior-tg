/**
 * Crypto Pay webhook handler utilities.
 *
 * @module infrastructure/payments/cryptopay-webhook
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { getAppDataSource } from "../db/datasource.js";
import { ServicePaymentService } from "../../domain/billing/ServicePaymentService.js";
import { Logger } from "../../app/logger.js";
import type { Bot, Api, RawApi } from "grammy";
import User from "../../entities/User.js";
import { getLazyFluent, pickLocale } from "../../shared/i18n/lazy-fluent.js";
import type ServiceInvoice from "../../entities/ServiceInvoice.js";

const getCryptoPayToken = (): string => {
  const token =
    process.env["PAYMENT_CRYPTOBOT_TOKEN"]?.trim() ||
    process.env["PAYMENT_CRYPTO_PAY_TOKEN"]?.trim();
  if (!token) {
    throw new Error(
      "PAYMENT_CRYPTOBOT_TOKEN or PAYMENT_CRYPTO_PAY_TOKEN is not set"
    );
  }
  return token;
};

const getSignatureHeader = (req: Request): string | undefined => {
  const header =
    (req.headers["crypto-pay-api-signature"] as string | undefined) ||
    (req.headers["crypto-pay-api-signature".toLowerCase()] as string | undefined);
  return header;
};

const verifySignature = (rawBody: string, signature?: string): boolean => {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature.trim())) {
    return false;
  }
  const token = getCryptoPayToken();
  const expected = createHmac("sha256", token).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature.trim(), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const parseInvoicePayload = (body: any): { invoiceId?: string; status?: string; payload?: string } => {
  const data = body?.payload ?? body?.invoice ?? body;
  const invoiceId =
    data?.invoice_id ?? data?.invoiceId ?? body?.invoice_id ?? body?.invoiceId;
  const status = data?.status ?? body?.status;
  const payload = data?.payload ?? body?.payload;
  return {
    invoiceId: invoiceId ? String(invoiceId) : undefined,
    status,
    payload,
  };
};

const formatPaidUntil = (paidUntil: Date | null, locale: string): string => {
  if (!paidUntil) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(paidUntil);
};

const buildPaidMessage = async (
  invoice: ServiceInvoice,
  paidUntil: Date | null
): Promise<string> => {
  const translate = await getLazyFluent();
  const dataSource = await getAppDataSource();
  const user = await dataSource.getRepository(User).findOne({ where: { id: invoice.userId } });
  const locale = pickLocale(user?.lang);
  const date = formatPaidUntil(paidUntil, locale);
  return translate(locale, "service-payment-paid", { date });
};

export const handleCryptoPayWebhook = async (
  req: Request,
  res: Response,
  bot: Bot<any, Api<RawApi>>
): Promise<void> => {
  try {
    const rawBody = (req as any).rawBody as string | undefined;
    if (!rawBody) {
      res.status(400).send("missing raw body");
      return;
    }
    const signature = getSignatureHeader(req);
    if (!verifySignature(rawBody, signature)) {
      res.status(401).send("invalid signature");
      return;
    }

    const { invoiceId, status, payload } = parseInvoicePayload(req.body);
    if (!invoiceId) {
      res.status(400).send("missing invoice_id");
      return;
    }

    if (status !== "paid" && status !== "paid_over" && req.body?.update_type !== "invoice_paid") {
      res.status(200).send("ignored");
      return;
    }

    const dataSource = await getAppDataSource();
    const service = new ServicePaymentService(dataSource);
    const invoice = await service.handlePaidInvoice(invoiceId, payload || null);
    if (!invoice) {
      res.status(200).send("ok");
      return;
    }

    const paidUntil = await service.getPaidUntil(invoice);
    if (invoice.chatId && invoice.messageId) {
      const message = await buildPaidMessage(invoice, paidUntil);
      await bot.api.editMessageText(
        invoice.chatId,
        invoice.messageId,
        message,
        { parse_mode: "HTML" }
      );
    }

    res.status(200).send("ok");
  } catch (error) {
    Logger.error("Crypto Pay webhook error", error);
    res.status(500).send("error");
  }
};
