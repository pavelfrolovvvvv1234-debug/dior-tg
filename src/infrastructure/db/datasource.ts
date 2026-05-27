/**
 * TypeORM DataSource configuration and initialization.
 *
 * @module infrastructure/db/datasource
 */

import { DataSource } from "typeorm";
import { Logger } from "../../app/logger.js";
import { runRoleModelMigration } from "./role-migration.js";
import { runProvisioningStatusMigration } from "./provisioning-status-migration.js";
import { runPromoOrderDiscountMigrations } from "./promo-order-discount-migration.js";
import { dedupeVdslistDuplicateVdsIds } from "./vdslist-dedupe.js";
import { resolveSqliteDatabasePath } from "./sqlite-config.js";
import { buildDataSourceOptions, resolveDatabaseKind } from "./datasource-options.js";

const AppDataSource = new DataSource(buildDataSourceOptions());

let initialized = false;

export async function getAppDataSource(): Promise<DataSource> {
  if (AppDataSource.isInitialized) {
    return AppDataSource;
  }

  if (!initialized) {
    initialized = true;
    try {
      if (resolveDatabaseKind() === "sqlite") {
        dedupeVdslistDuplicateVdsIds(resolveSqliteDatabasePath());
      }

      await AppDataSource.initialize();
      await runRoleModelMigration(AppDataSource);
      await runProvisioningStatusMigration(AppDataSource);
      await runPromoOrderDiscountMigrations(AppDataSource);
      Logger.info("Database DataSource initialized successfully", {
        driver: resolveDatabaseKind(),
      });
    } catch (error) {
      Logger.error("Failed to initialize DataSource", error);
      initialized = false;
      throw error;
    }
  }

  return AppDataSource;
}

export async function closeDataSource(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
    Logger.info("Database DataSource closed");
  }
}
