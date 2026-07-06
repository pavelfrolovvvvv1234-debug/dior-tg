/**
 * Seed shared network_ip_allocations from Proxmox (ipconfig0 + live guest IP).
 *
 * Usage:
 *   tsx scripts/sync-shared-ip-registry.ts --dry-run
 *   tsx scripts/sync-shared-ip-registry.ts
 */
import { isProxmoxEnabled } from "../src/app/config.js";
import { getNetworkIpRegistry, getSharedIpDataSource } from "../src/infrastructure/db/network-ip-registry.js";
import { ProxmoxProvider } from "../src/infrastructure/vmmanager/ProxmoxProvider.js";
import { parseIpFromIpConfig, readProxmoxNetworkEnv, isIpv4InCidr } from "../src/shared/proxmox/ip-allocation.js";
import NetworkIpAllocation from "../src/entities/NetworkIpAllocation.js";

async function main(): Promise<void> {
  if (!isProxmoxEnabled()) {
    console.error("Proxmox is not enabled.");
    process.exit(1);
  }

  const ipRegistry = await getNetworkIpRegistry();
  const sharedDs = await getSharedIpDataSource();
  if (!ipRegistry || !sharedDs) {
    console.error("SHARED_IP_DATABASE_URL / BILLING_DATABASE_URL is not configured.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const network =
    readProxmoxNetworkEnv().cidr ??
    process.env.PROXMOX_NETWORK?.trim() ??
    "45.74.7.0/24";

  const provider = new ProxmoxProvider(ipRegistry);
  const guests = await provider.enumerateQemuGuests();
  let inserted = 0;
  let skipped = 0;

  for (const guest of guests) {
    const fromConfig = parseIpFromIpConfig(guest.ipconfig0);
    const live = await provider.getIpv4AddrVM(guest.vmid);
    const ip = fromConfig ?? live?.list?.find((row) => row.ip_addr && row.ip_addr !== "0.0.0.0")?.ip_addr;
    if (!ip) {
      skipped += 1;
      continue;
    }
    if (!isIpv4InCidr(ip, network)) {
      skipped += 1;
      continue;
    }

    const existing = await sharedDs.getRepository(NetworkIpAllocation).findOne({
      where: { ip },
    });
    if (existing && existing.status !== "released") {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        `[dry-run] would ${existing?.status === "released" ? "reactivate" : "register"} ${ip} vmid=${guest.vmid}`
      );
      inserted += 1;
      continue;
    }

    try {
      if (existing?.status === "released") {
        await sharedDs.getRepository(NetworkIpAllocation).update(existing.id, {
          network,
          owner: "telegram_bot",
          status: "active",
          vmid: guest.vmid,
          releasedAt: null,
        });
      } else {
        await sharedDs.getRepository(NetworkIpAllocation).save(
          sharedDs.getRepository(NetworkIpAllocation).create({
            ip,
            network,
            owner: "telegram_bot",
            status: "active",
            vmid: guest.vmid,
            releasedAt: null,
          })
        );
      }
      inserted += 1;
      console.log(`registered ${ip} vmid=${guest.vmid}`);
    } catch {
      skipped += 1;
    }
  }

  console.log(JSON.stringify({ dryRun, network, inserted, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
