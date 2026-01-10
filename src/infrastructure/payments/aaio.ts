/**
 * AAIO payment provider adapter.
 *
 * @module infrastructure/payments/aaio
 */

import type { IPaymentProvider, Invoice, InvoiceStatus } from "./types.js";
import { PaymentProviderName } from "./types.js";
import { PaymentError } from "../../shared/errors/index.js";
import { config } from "../../app/config.js";
import { Logger } from "../../app/logger.js";

/**
 * AAIO payment provider implementation.
 */
export class AAIOProvider implements IPaymentProvider {
  readonly name: PaymentProviderName = "aaio";

  private async getClient() {
    try {
      const AAIO = await import("aaio.js");
      const client = new AAIO.Client(config.PAYMENT_AAIO_TOKEN);
      const merchant = client.createMerchant(
        config.PAYMENT_AAIO_ID,
        config.PAYMENT_AAIO_SECRET_ONE
      );
      return { client, merchant };
    } catch (error) {
      Logger.error("Failed to initialize AAIO client", error);
      throw new PaymentError("Failed to initialize AAIO client", "aaio");
    }
  }

  async createInvoice(
    amount: number,
    orderId: string
  ): Promise<Invoice> {
    try {
      const { merchant } = await this.getClient();
      const url = await merchant.createPaymentByRequest(
        amount,
        orderId,
        "USD"
      );

      return {
        id: orderId,
        url,
        amount,
        provider: this.name,
        status: InvoiceStatus.PENDING,
      };
    } catch (error) {
      Logger.error("Failed to create AAIO invoice", error);
      throw new PaymentError("Failed to create AAIO invoice", "aaio");
    }
  }

  async checkStatus(invoiceId: string): Promise<InvoiceStatus> {
    try {
      const { merchant } = await this.getClient();
      const paymentInfo = await merchant.getPaymentInfo(invoiceId);

      switch (paymentInfo.status) {
        case "success":
          return InvoiceStatus.PAID;
        case "expired":
          return InvoiceStatus.EXPIRED;
        default:
          return InvoiceStatus.PENDING;
      }
    } catch (error) {
      Logger.error("Failed to check AAIO invoice status", error);
      throw new PaymentError("Failed to check AAIO invoice status", "aaio");
    }
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    try {
      const { merchant } = await this.getClient();
      const paymentInfo = await merchant.getPaymentInfo(invoiceId);

      let status: InvoiceStatus;
      switch (paymentInfo.status) {
        case "success":
          status = InvoiceStatus.PAID;
          break;
        case "expired":
          status = InvoiceStatus.EXPIRED;
          break;
        default:
          status = InvoiceStatus.PENDING;
      }

      return {
        id: invoiceId,
        url: "", // AAIO doesn't return URL on status check
        amount: paymentInfo.amount || 0,
        provider: this.name,
        status,
      };
    } catch (error) {
      Logger.error("Failed to get AAIO invoice", error);
      throw new PaymentError("Failed to get AAIO invoice", "aaio");
    }
  }
}
