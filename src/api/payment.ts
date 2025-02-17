import { getAppDataSource } from "@/database";
import TopUp, { TopUpStatus } from "@entities/TopUp";
import { randomUUID } from "crypto";
import { CrystalPayClient } from "./crystal-pay";
import User from "@entities/User";
import { Api, Bot, RawApi } from "grammy";
import { MyAppContext } from "..";

async function createAAIOClient() {
  const AAIO = await import("aaio.js");
  const aaioclient = new AAIO.Client(process.env["PAYMENT_AAIO_TOKEN"]);

  const aaiomerchant = aaioclient.createMerchant(
    process.env["PAYMENT_AAIO_ID"],
    process.env["PAYMENT_AAIO_SECRET_ONE"]
  );

  return { aaioclient, aaiomerchant };
}

export class PaymentBuilder {
  constructor(private amount: number, private targetUser: number) {}

  private generatedOrderId() {
    return randomUUID();
  }

  async createAAIOPayment(): Promise<TopUp> {
    const { aaiomerchant } = await createAAIOClient();
    const appdatasource = await getAppDataSource();
    const repo = appdatasource.getRepository(TopUp);

    const topUp = new TopUp();
    topUp.orderId = this.generatedOrderId();
    topUp.amount = this.amount;
    topUp.target_user_id = this.targetUser;
    topUp.paymentSystem = "aaio";

    const url = await aaiomerchant.createPaymentByRequest(
      this.amount,
      topUp.orderId,
      "USD"
    );

    topUp.url = url;

    return await repo.save(topUp);
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
        case "aaio": {
          const { aaiomerchant, aaioclient } = await createAAIOClient();

          const paymentInfo = await aaiomerchant.getPaymentInfo(topUp.orderId);

          if (paymentInfo.status === "success") {
            topUp.status = TopUpStatus.Completed;
            await repo.save(topUp);
            paymentSuccess(topUp.target_user_id, topUp.id, bot).then();
          }

          if (paymentInfo.status === "expired") {
            topUp.status = TopUpStatus.Expired;
            await repo.save(topUp);
          }

          // Very comfortable debug
          // console.log({ ...paymentInfo, orderID: topUp.orderId });

          break;
        }
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

  bot.api
    .sendMessage(
      user.telegramId,
      `+ ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(topUp.amount)} $`
    )
    .then();
}
