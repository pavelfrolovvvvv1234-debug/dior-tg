import type { Response } from "express";
import type { DataSource } from "typeorm";
import VirtualDedicatedServer from "../entities/VirtualDedicatedServer.js";
import type { VmProvider } from "../infrastructure/vmmanager/provider.js";
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
