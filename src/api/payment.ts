import { getAppDataSource } from "@/database";
import TopUp, { TopUpStatus } from "@entities/TopUp";
import { randomUUID } from "crypto";
import { CrystalPayClient } from "./crystal-pay";
import User from "@entities/User";
import { Api, Bot, RawApi } from "grammy";
import { MyAppContext } from "..";
import axios from "axios";

const CRYPTOBOT_API_URL = "https://pay.crypt.bot/api";

type CryptoBotInvoiceResult = {
  invoice_id: number;
  pay_url?: string;
  bot_invoice_url?: string;
  status: "active" | "paid" | "expired" | "paid_over";
};

type CryptoBotResponse<T> = {
  ok: boolean;
  result?: T;
  error?: {
    name?: string;
    code?: number;
  };
};

function getCryptoBotToken(): string {
  const token =
    process.env["PAYMENT_CRYPTOBOT_TOKEN"]?.trim() ||
    process.env["PAYMENT_CRYPTO_PAY_TOKEN"]?.trim();
  if (!token) {
    throw new Error(
      "PAYMENT_CRYPTOBOT_TOKEN or PAYMENT_CRYPTO_PAY_TOKEN is not set"
    );
  }
  return token;
}

async function createCryptoBotInvoice(amount: number): Promise<CryptoBotInvoiceResult> {
  const token = getCryptoBotToken();
  const response = await axios.post<CryptoBotResponse<CryptoBotInvoiceResult>>(
    `${CRYPTOBOT_API_URL}/createInvoice`,
    {
      asset: "USDT",
      amount: amount.toString(),
    },
    {
      headers: {
        "Crypto-Pay-API-Token": token,
      },
    }
  );

  if (!response.data?.ok || !response.data.result) {
    const errorName = response.data?.error?.name || "CryptoBot invoice failed";
    throw new Error(errorName);
  }

  return response.data.result;
}

async function getCryptoBotInvoiceStatus(
  invoiceId: string
): Promise<CryptoBotInvoiceResult["status"]> {
  const token = getCryptoBotToken();
  const response = await axios.post<
    CryptoBotResponse<{ items: CryptoBotInvoiceResult[] }>
  >(
    `${CRYPTOBOT_API_URL}/getInvoices`,
    {
      invoice_ids: [Number(invoiceId)],
    },
    {
      headers: {
        "Crypto-Pay-API-Token": token,
      },
    }
  );

  if (!response.data?.ok || !response.data.result?.items?.length) {
    const errorName =
      response.data?.error?.name || "CryptoBot invoice not found";
    throw new Error(errorName);
  }

  return response.data.result.items[0].status;
}

export class PaymentBuilder {
  constructor(private amount: number, private targetUser: number) {}

  private generatedOrderId() {
    return randomUUID();
  }

  async createCrystalPayment(): Promise<TopUp> {
    const crystalpay = new CrystalPayClient(
      process.env["PAYMENT_CRYSTALPAY_ID"],
      process.env["PAYMENT_CRYSTALPAY_SECRET_ONE"]
    );

    const appdatasource = await getAppDataSource();
    const repo = appdatasource.getRepository(TopUp);

    const topUp = new TopUp();

    const invoice = await crystalpay.createInvoice(this.amount);
    topUp.orderId = invoice.id;
    topUp.amount = this.amount;
    topUp.target_user_id = this.targetUser;
    topUp.paymentSystem = "crystalpay";
    topUp.url = invoice.url;

    return await repo.save(topUp);
  }

  async createCryptoBotPayment(): Promise<TopUp> {
    const appdatasource = await getAppDataSource();
    const repo = appdatasource.getRepository(TopUp);

    const topUp = new TopUp();
    const invoice = await createCryptoBotInvoice(this.amount);

    topUp.orderId = String(invoice.invoice_id);
    topUp.amount = this.amount;
    topUp.target_user_id = this.targetUser;
    topUp.paymentSystem = "cryptobot";
    topUp.url = invoice.bot_invoice_url ?? invoice.pay_url ?? "";

    return await repo.save(topUp);
  }
}

export async function startCheckTopUpStatus(
  bot: Bot<MyAppContext, Api<RawApi>>
) {
  // Every 10 seconds
  setInterval(async () => {
    const appdatasource = await getAppDataSource();
    const repo = appdatasource.getRepository(TopUp);

    const allTopUps = await repo.find({
      where: {
        status: TopUpStatus.Created,
      },
    });

    for (const topUp of allTopUps) {
      switch (topUp.paymentSystem) {
        case "crystalpay": {
          const crystalpay = new CrystalPayClient(
            process.env["PAYMENT_CRYSTALPAY_ID"],
            process.env["PAYMENT_CRYSTALPAY_SECRET_ONE"]
          );

          const invoiceInfo = await crystalpay.getInvoice(topUp.orderId);

          if (invoiceInfo.state === "payed") {
            topUp.status = TopUpStatus.Completed;
            await repo.save(topUp);
            paymentSuccess(topUp.target_user_id, topUp.id, bot).then();
          }

          if (
            invoiceInfo.state === "failed" ||
            invoiceInfo.state === "unavailable"
          ) {
            topUp.status = TopUpStatus.Expired;
            await repo.save(topUp);
          }

          const expiredAt = new Date(invoiceInfo.expired_at + " UTC+3");
          if (expiredAt < new Date()) {
            topUp.status = TopUpStatus.Expired;
            await repo.save(topUp);
          }

          break;
        }
        case "cryptobot": {
          const cryptopayToken =
            process.env["PAYMENT_CRYPTOBOT_TOKEN"]?.trim() ||
            process.env["PAYMENT_CRYPTO_PAY_TOKEN"]?.trim();
          if (!cryptopayToken) {
            break;
          }
          try {
            const status = await getCryptoBotInvoiceStatus(topUp.orderId);

            if (status === "paid" || status === "paid_over") {
              topUp.status = TopUpStatus.Completed;
              await repo.save(topUp);
              paymentSuccess(topUp.target_user_id, topUp.id, bot).then();
            }

            if (status === "expired") {
              topUp.status = TopUpStatus.Expired;
              await repo.save(topUp);
            }
          } catch (err) {
            console.error(`[Payment] CryptoBot status check failed for ${topUp.orderId}:`, err);
          }
          break;
        }
      }
    }
  }, 10_000);
}

async function paymentSuccess(
  targetUser: number,
  topUpId: number,
  bot: Bot<MyAppContext, Api<RawApi>>
) {
  const datasource = await getAppDataSource();
  const topUpRepo = datasource.getRepository(TopUp);
  const usersRepo = datasource.getRepository(User);

  const user = await usersRepo.findOneBy({
    id: targetUser,
  });

  if (!user) {
    return;
  }

  const topUp = await topUpRepo.findOneBy({
    id: topUpId,
  });

  if (!topUp) {
    return;
  }

  user.balance += topUp.amount;

  await usersRepo.save(user);

  // Apply referral reward if applicable
  try {
    const { ReferralService } = await import("../domain/referral/ReferralService.js");
    const { UserRepository } = await import("../infrastructure/db/repositories/UserRepository.js");
    const userRepo = new UserRepository(datasource);
    const referralService = new ReferralService(datasource, userRepo);
    const rewardAmount = await referralService.applyReferralRewardOnTopup(
      targetUser,
      topUpId,
      topUp.amount
    );

    if (rewardAmount > 0) {
      console.log(`[Referral] Applied reward ${rewardAmount} for topUp ${topUpId}`);
    }
  } catch (error: any) {
    console.error(`[Referral] Failed to apply referral reward:`, error);
    // Don't fail payment if referral reward fails
  }

  let balanceMessage = `+ ${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(topUp.amount)} $`;
  try {
    const { GrowthService } = await import("../modules/growth/growth.service.js");
    const growthService = new GrowthService(datasource);
    const growthResult = await growthService.handleTopUpSuccess(targetUser, topUpId, topUp.amount);
    if (growthResult.upsellBonusApplied > 0) {
      balanceMessage += `\n+ бонус ${growthResult.upsellBonusApplied.toFixed(2)} $`;
    }
    if (growthResult.reactivationBonusApplied > 0) {
      balanceMessage += `\n+ бонус возврата ${growthResult.reactivationBonusApplied.toFixed(2)} $`;
    }
    if (growthResult.upsellOfferCreated && growthResult.messageOffer) {
      bot.api
        .sendMessage(user.telegramId, growthResult.messageOffer, { parse_mode: "HTML" })
        .catch(() => {});
    }
  } catch (growthErr: any) {
    console.error(`[Growth] handleTopUpSuccess failed:`, growthErr);
  }

  bot.api.sendMessage(user.telegramId, balanceMessage).then();

  // Emit automation event for deposit.completed
  try {
    const { emit } = await import("../modules/automations/engine/event-bus.js");
    emit({
      event: "deposit.completed",
      userId: targetUser,
      timestamp: new Date(),
      topUpId,
      amount: topUp.amount,
      targetUserId: targetUser,
    });
  } catch (e) {
    // Ignore if automations module not available
  }

  // At most one commercial campaign per 72h: tier upgrade, large deposit, or referral push
  try {
    const { canSendCommercialPush, markCommercialPushSent } = await import(
      "../modules/growth/campaigns/commercial-limiter.js"
    );
    const { getCumulativeDeposit, getTierUpgradeInfo } = await import(
      "../modules/growth/campaigns/tier.campaign.js"
    );
    const { handleLargeDeposit } = await import("../modules/growth/campaigns/large-deposit.campaign.js");
    const {
      shouldSendReferralPush,
      getReferralPushMessage,
      markReferralPushSent,
    } = await import("../modules/growth/campaigns/referral-push.campaign.js");
    if (await canSendCommercialPush(targetUser)) {
      const newLtv = await getCumulativeDeposit(datasource, targetUser);
      const tierInfo = await getTierUpgradeInfo(datasource, targetUser, newLtv);
      if (tierInfo) {
        await bot.api.sendMessage(user.telegramId, tierInfo.message, { parse_mode: "HTML" }).catch(() => {});
        await markCommercialPushSent(targetUser);
        try {
          const { emit } = await import("../modules/automations/engine/event-bus.js");
          emit({
            event: "tier.achieved",
            userId: targetUser,
            timestamp: new Date(),
            tier: tierInfo.newTier,
            previousTier: tierInfo.previousTier,
            cumulativeDeposit: tierInfo.cumulativeDeposit,
          });
        } catch {
          // Ignore if automations module not available
        }
      } else {
        const largeResult = await handleLargeDeposit(datasource, targetUser, topUp.amount);
        if (largeResult.shouldSendMessage && largeResult.message) {
          await bot.api.sendMessage(user.telegramId, largeResult.message, { parse_mode: "HTML" }).catch(() => {});
          await markCommercialPushSent(targetUser);
        } else if (await shouldSendReferralPush(datasource, targetUser, topUp.amount)) {
          await bot.api
            .sendMessage(user.telegramId, getReferralPushMessage(), { parse_mode: "HTML" })
            .catch(() => {});
          await markReferralPushSent(targetUser);
          await markCommercialPushSent(targetUser);
        }
      }
    }
  } catch (campaignErr: any) {
    console.error(`[Growth] Post-payment campaigns failed:`, campaignErr);
  }
}
