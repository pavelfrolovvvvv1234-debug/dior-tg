import type { DataSource, EntityManager } from "typeorm";
import ResellerWalletTransaction from "../../../entities/ResellerWalletTransaction.js";
import TopUp, { TopUpStatus } from "../../../entities/TopUp.js";
import { getResellerBillingUser } from "./reseller-billing.js";

export type ResellerLedgerWrite = {
  type: "service_create" | "service_renew";
  serviceId: number;
  vmid?: number;
  detail?: string;
};

export async function recordResellerWalletDebit(
  em: EntityManager,
  resellerId: string,
  amountUsd: number,
  balanceAfterUsd: number,
  ledger: ResellerLedgerWrite
): Promise<void> {
  const row = em.create(ResellerWalletTransaction, {
    resellerId,
    amountUsd: -Math.abs(amountUsd),
    balanceAfterUsd,
    type: ledger.type,
    serviceId: ledger.serviceId,
    vmid: ledger.vmid ?? null,
    detail: ledger.detail ?? null,
  });
  await em.save(row);
}

export type ResellerBillingTransactionRow = {
  id: string;
  source: "wallet" | "topup";
  type: string;
  amountUsd: number;
  balanceAfterUsd: number | null;
  serviceId: number | null;
  vmid: number | null;
  detail: string | null;
  paymentSystem: string | null;
  createdAt: Date;
};

export type ResellerBillingTransactionsResult =
  | { ok: true; items: ResellerBillingTransactionRow[] }
  | { ok: false; error: string };

export async function listResellerBillingTransactions(
  dataSource: DataSource,
  resellerId: string,
  limit: number
): Promise<ResellerBillingTransactionsResult> {
  const billing = await getResellerBillingUser(dataSource, resellerId);
  if (!billing.ok) return { ok: false, error: billing.error };

  const walletRepo = dataSource.getRepository(ResellerWalletTransaction);
  const walletRows = await walletRepo.find({
    where: { resellerId },
    order: { id: "DESC" },
    take: limit,
  });

  const topupRepo = dataSource.getRepository(TopUp);
  const topups = await topupRepo.find({
    where: { target_user_id: billing.user.id, status: TopUpStatus.Completed },
    order: { id: "DESC" },
    take: limit,
  });

  const merged: ResellerBillingTransactionRow[] = [
    ...walletRows.map((w) => ({
      id: `wallet:${w.id}`,
      source: "wallet" as const,
      type: w.type,
      amountUsd: w.amountUsd,
      balanceAfterUsd: w.balanceAfterUsd,
      serviceId: w.serviceId,
      vmid: w.vmid,
      detail: w.detail,
      paymentSystem: null,
      createdAt: w.createdAt,
    })),
    ...topups.map((t) => ({
      id: `topup:${t.id}`,
      source: "topup" as const,
      type: "balance_topup",
      amountUsd: t.amount,
      balanceAfterUsd: null,
      serviceId: null,
      vmid: null,
      detail: t.orderId ? `order:${t.orderId}` : null,
      paymentSystem: t.paymentSystem,
      createdAt: t.createdAt,
    })),
  ];

  merged.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { ok: true, items: merged.slice(0, limit) };
}
