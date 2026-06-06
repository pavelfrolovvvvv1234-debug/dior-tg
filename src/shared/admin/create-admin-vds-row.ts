import VirtualDedicatedServer from "../../entities/VirtualDedicatedServer.js";
import { resolveVdsLoginForOs } from "../vmm-os-display.js";
import type { AdminVpsServiceBlock } from "./parse-managed-service-input.js";
import {
  defaultAdminVpsExpireDate,
  formatAdminVpsExpireToken,
  resolveVdsPlanSpec,
} from "./vds-plan-catalog.js";

export function wizardDraftFromVpsBlock(block: AdminVpsServiceBlock): Record<string, string | number> {
  const planSpec = resolveVdsPlanSpec(block.plan);
  const expiresAt = block.expiresAt ?? defaultAdminVpsExpireDate(30);
  return {
    ipv4: block.ip,
    login: "root",
    password: "Not set",
    provider: "Proxmox",
    osLabel: "—",
    vmid: block.vmid,
    rateName: planSpec?.name ?? block.plan,
    expireAt: formatAdminVpsExpireToken(expiresAt),
    cpuCount: planSpec?.cpu ?? 1,
    ramGb: planSpec?.ram ?? 1,
    diskGb: planSpec?.ssd ?? 10,
    renewalPrice: block.price ?? planSpec?.priceBulletproof ?? 0,
  };
}

export function buildAdminImportedVdsRow(input: {
  targetUserId: number;
  vmid: number;
  ip: string;
  plan: string;
  price: number;
  expiresAt: Date;
  osId?: number;
}): VirtualDedicatedServer {
  const planSpec = resolveVdsPlanSpec(input.plan);
  const row = new VirtualDedicatedServer();
  row.targetUserId = input.targetUserId;
  row.vdsId = input.vmid;
  row.login = resolveVdsLoginForOs({ osId: input.osId ?? 0 });
  row.password = "Not set";
  row.ipv4Addr = input.ip;
  row.cpuCount = planSpec?.cpu ?? 1;
  row.networkSpeed = planSpec?.network ?? 1000;
  row.isBulletproof = true;
  row.payDayAt = null;
  row.ramSize = planSpec?.ram ?? 1;
  row.diskSize = planSpec?.ssd ?? 10;
  row.lastOsId = input.osId ?? 0;
  row.rateName = planSpec?.name ?? input.plan;
  row.expireAt = input.expiresAt;
  row.renewalPrice = input.price;
  row.displayName = row.rateName.slice(0, 32);
  row.bundleType = null;
  row.autoRenewEnabled = true;
  row.adminBlocked = false;
  row.managementLocked = false;
  row.extraIpv4Count = 0;
  row.resellerId = null;
  row.resellerClientId = null;
  return row;
}
