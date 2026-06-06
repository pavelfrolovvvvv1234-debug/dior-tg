import type { Response } from "express";
import type { DataSource } from "typeorm";
import VirtualDedicatedServer from "../entities/VirtualDedicatedServer.js";
import {
  getExtraIpv4MonthlyPriceUsd,
  MAX_EXTRA_IPV4_PER_VDS,
} from "../domain/vds/extra-ipv4.js";
import type { VmProvider } from "../infrastructure/vmmanager/provider.js";
import {
  assertResellerCanAfford,
  debitResellerBalance,
} from "../modules/reseller/services/reseller-billing.js";
import { retry } from "../shared/utils/retry.js";

export type AuthRequestMeta = { requestId: string };

export function providerHas<K extends keyof VmProvider>(
  vm: VmProvider,
  method: K
): vm is VmProvider & Required<Pick<VmProvider, K>> {
  return typeof vm[method] === "function";
}

export function respondVmNotSupported(
  res: Response,
  meta: AuthRequestMeta,
  error: "not_supported_on_provider" | "feature_not_available" = "not_supported_on_provider"
): void {
  res.status(501).json({ ok: false, error, ...meta });
}

export async function loadOwnedService(
  dataSource: DataSource,
  resellerId: string,
  serviceId: number
): Promise<VirtualDedicatedServer | null> {
  const repo = dataSource.getRepository(VirtualDedicatedServer);
  return (await repo.findOneBy({ id: serviceId, resellerId })) ?? null;
}

/** Best-effort purge of a VM created during a failed reseller provision. */
export async function deleteProvisionedVmWithRetry(
  vmProvider: VmProvider,
  vmid: number,
  attempts = 4
): Promise<void> {
  await retry(() => vmProvider.deleteVM(vmid), {
    maxAttempts: attempts,
    delayMs: 1500,
    exponentialBackoff: true,
  }).catch(() => {});
}

export function scheduleBackupCompletion(
  vm: VmProvider,
  taskId: string,
  onDone: (success: boolean) => void
): void {
  if (!providerHas(vm, "waitBackupTask")) {
    onDone(false);
    return;
  }
  void vm.waitBackupTask(taskId).then(onDone).catch(() => onDone(false));
}

export function isPlaceholderIpv4(ip?: string | null): boolean {
  return !ip || ip === "0.0.0.0" || ip === "127.0.0.1";
}

/** Merge DB primary IPv4 with live hypervisor addresses (deduped, stable order). */
export function mergeServiceIpv4Addresses(
  primary: string | null | undefined,
  apiIps: string[]
): string[] {
  const merged: string[] = [];
  const add = (ip: string) => {
    if (!isPlaceholderIpv4(ip) && !merged.includes(ip)) merged.push(ip);
  };
  if (primary) add(primary);
  for (const ip of apiIps) add(ip);
  return merged;
}

export async function fetchLiveServiceIpv4(
  vmProvider: VmProvider,
  vds: VirtualDedicatedServer
): Promise<string[]> {
  const data = await vmProvider.getIpv4AddrVM(vds.vdsId).catch(() => undefined);
  const apiIps = data?.list?.map((row) => row.ip_addr).filter(Boolean) ?? [];
  return mergeServiceIpv4Addresses(vds.ipv4Addr, apiIps);
}

export type ResellerExtraIpv4Result =
  | { ok: true; extraIp: string; monthlyPrice: number; vds: VirtualDedicatedServer }
  | {
      ok: false;
      error: string;
      httpStatus: number;
      required?: number;
      available?: number;
    };

/** Purchase one extra IPv4 for a reseller-owned service (debited from reseller wallet). */
export async function purchaseResellerExtraIpv4(
  dataSource: DataSource,
  vmProvider: VmProvider,
  resellerId: string,
  vds: VirtualDedicatedServer
): Promise<ResellerExtraIpv4Result> {
  if (vds.managementLocked || vds.adminBlocked) {
    return { ok: false, error: "service_suspended", httpStatus: 403 };
  }
  if ((vds.extraIpv4Count ?? 0) >= MAX_EXTRA_IPV4_PER_VDS) {
    return { ok: false, error: "extra_ipv4_limit_reached", httpStatus: 409 };
  }
  if (!providerHas(vmProvider, "addIpv4ToHost")) {
    return { ok: false, error: "not_supported_on_provider", httpStatus: 501 };
  }

  const monthlyPrice = getExtraIpv4MonthlyPriceUsd();
  const afford = await assertResellerCanAfford(dataSource, resellerId, monthlyPrice);
  if (!afford.ok) {
    return {
      ok: false,
      error: afford.error,
      httpStatus: afford.error === "insufficient_balance" ? 402 : 403,
      required: afford.required,
      available: afford.available,
    };
  }

  const assigned = await vmProvider.addIpv4ToHost(vds.vdsId);
  if (!assigned) {
    return { ok: false, error: "ipv4_assignment_failed", httpStatus: 502 };
  }

  let extraIp = "";
  for (let attempt = 0; attempt < 8; attempt++) {
    const ips = await fetchLiveServiceIpv4(vmProvider, vds);
    extraIp =
      ips.find((ip) => !isPlaceholderIpv4(vds.ipv4Addr) && ip !== vds.ipv4Addr) ??
      ips[1] ??
      "";
    if (extraIp) break;
    await new Promise((r) => setTimeout(r, 1500));
  }

  const tx = await dataSource.transaction(async (em) => {
    const vdsRepo = em.getRepository(VirtualDedicatedServer);
    const row = await vdsRepo.findOneBy({ id: vds.id, resellerId });
    if (!row) return { kind: "not_found" as const };
    if ((row.extraIpv4Count ?? 0) >= MAX_EXTRA_IPV4_PER_VDS) {
      return { kind: "limit" as const };
    }
    const debit = await debitResellerBalance(em, resellerId, monthlyPrice, {
      type: "extra_ipv4",
      serviceId: row.id,
      vmid: row.vdsId,
      detail: extraIp || "pending",
    });
    if (!debit.ok) {
      return {
        kind: "billing_failed" as const,
        error: debit.error,
        required: debit.required,
        available: debit.available,
      };
    }
    row.extraIpv4Count = (row.extraIpv4Count ?? 0) + 1;
    row.renewalPrice = Math.round((Number(row.renewalPrice) + monthlyPrice) * 100) / 100;
    const saved = await vdsRepo.save(row);
    return { kind: "saved" as const, saved };
  });

  if (tx.kind === "not_found") {
    return { ok: false, error: "service_not_found", httpStatus: 404 };
  }
  if (tx.kind === "limit") {
    return { ok: false, error: "extra_ipv4_limit_reached", httpStatus: 409 };
  }
  if (tx.kind === "billing_failed") {
    return {
      ok: false,
      error: tx.error,
      httpStatus: tx.error === "insufficient_balance" ? 402 : 403,
      required: tx.required,
      available: tx.available,
    };
  }

  return {
    ok: true,
    extraIp: extraIp || "pending",
    monthlyPrice,
    vds: tx.saved,
  };
}
