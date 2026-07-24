/**
 * Ensures vdslist.hypervisor + providerServerId when TypeORM synchronize is off.
 *
 * @module infrastructure/db/ensure-vdslist-hostvds-schema
 */

import type { DataSource } from "typeorm";
import { Logger } from "../../app/logger.js";
import { resolveDatabaseKind } from "./datasource-options.js";

export async function ensureVdslistHostVdsSchema(dataSource: DataSource): Promise<void> {
  const runner = dataSource.createQueryRunner();
  try {
    const table = await runner.getTable("vdslist");
    if (!table) return;

    const hasHypervisor = table.columns.some((c) => c.name === "hypervisor");
    const hasProviderServerId = table.columns.some((c) => c.name === "providerServerId");
    if (hasHypervisor && hasProviderServerId) return;

    const kind = resolveDatabaseKind();
    if (!hasHypervisor) {
      if (kind === "postgres") {
        await runner.query(`ALTER TABLE vdslist ADD COLUMN IF NOT EXISTS hypervisor VARCHAR(32)`);
      } else {
        await runner.query(`ALTER TABLE vdslist ADD COLUMN hypervisor VARCHAR(32)`);
      }
    }
    if (!hasProviderServerId) {
      if (kind === "postgres") {
        await runner.query(
          `ALTER TABLE vdslist ADD COLUMN IF NOT EXISTS "providerServerId" VARCHAR(64)`
        );
      } else {
        await runner.query(`ALTER TABLE vdslist ADD COLUMN providerServerId VARCHAR(64)`);
      }
    }
    Logger.info("[HostVDS] ensured vdslist.hypervisor / providerServerId columns");
  } catch (e) {
    Logger.warn("[HostVDS] ensureVdslistHostVdsSchema:", e instanceof Error ? e.message : e);
  } finally {
    await runner.release();
  }
}
