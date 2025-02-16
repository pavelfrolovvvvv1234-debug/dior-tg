import { getAppDataSource } from "@/database";
import TopUp from "@entities/TopUp";
import { randomUUID } from "crypto";

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
  private generatedOrderId() {
    return randomUUID();
  }

  async createAAIOPayment(amount: number, targetUser: number) {
    const { aaiomerchant } = await createAAIOClient();
    const appdatasource = await getAppDataSource();
    const repo = appdatasource.getRepository(TopUp);

    const topUp = new TopUp();
    topUp.orderId = this.generatedOrderId();
    topUp.amount = amount;
    topUp.target_user_id = targetUser;

    const url = await aaiomerchant.createPaymentByRequest(
      amount,
      this.generatedOrderId(),
      "USD"
    );

    topUp.url = url;

    return await repo.save(topUp);
  }
}
