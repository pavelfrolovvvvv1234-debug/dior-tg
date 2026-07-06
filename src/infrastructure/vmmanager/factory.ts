import { config, isProxmoxEnabled } from "../../app/config.js";
import { Logger } from "../../app/logger.js";
import type { NetworkIpRegistry } from "../../domain/network/NetworkIpRegistry.js";
import {
  getNetworkIpRegistry,
  isSharedIpRegistryRequired,
} from "../db/network-ip-registry.js";
import { VMManager } from "./VMManager.js";
import { ProxmoxProvider } from "./ProxmoxProvider.js";
import type { VmProvider } from "./provider.js";

export function createVmProvider(options?: { ipRegistry?: NetworkIpRegistry | null }): VmProvider {
  const provider = (config.VM_PROVIDER ?? "vmmanager").toLowerCase();
  if (provider === "proxmox" && isProxmoxEnabled()) {
    Logger.info("Using Proxmox VM provider");
    return new ProxmoxProvider(options?.ipRegistry ?? null);
  }
  Logger.info("Using VMManager provider");
  return new VMManager(process.env["VMM_EMAIL"] ?? "", process.env["VMM_PASSWORD"] ?? "");
}

export async function createVmProviderAsync(): Promise<VmProvider> {
  const ipRegistry = await getNetworkIpRegistry();
  if (!ipRegistry && isSharedIpRegistryRequired() && isProxmoxEnabled()) {
    Logger.error(
      "Shared IP registry is required (PROXMOX_REQUIRE_SHARED_IP_REGISTRY=1) but SHARED_IP_DATABASE_URL / BILLING_DATABASE_URL is missing"
    );
  }
  return createVmProvider({ ipRegistry });
}
