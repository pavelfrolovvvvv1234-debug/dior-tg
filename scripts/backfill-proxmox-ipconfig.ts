/**
 * Backfill missing ipconfig0 on existing Proxmox QEMU guests (TG-bot legacy VMs).
 *
 * Usage:
 *   tsx scripts/backfill-proxmox-ipconfig.ts
 *   tsx scripts/backfill-proxmox-ipconfig.ts --dry-run
 */
import { isProxmoxEnabled } from "../src/app/config.js";
import { createVmProviderAsync } from "../src/infrastructure/vmmanager/factory.js";
import { ProxmoxProvider } from "../src/infrastructure/vmmanager/ProxmoxProvider.js";

async function main(): Promise<void> {
  if (!isProxmoxEnabled()) {
    console.error("Proxmox is not enabled. Set VM_PROVIDER=proxmox and PROXMOX_* env vars.");
    process.exit(1);
  }

  const dryRun = process.argv.includes("--dry-run");
  const provider = await createVmProviderAsync();
  if (!(provider instanceof ProxmoxProvider)) {
    console.error("VM provider is not Proxmox.");
    process.exit(1);
  }
  const result = await provider.backfillMissingIpconfig0({ dryRun });

  console.log(
    JSON.stringify(
      {
        dryRun,
        ...result,
      },
      null,
      2
    )
  );

  if (result.failed > 0) process.exit(2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
