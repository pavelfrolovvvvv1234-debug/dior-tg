import type { DataSource } from "typeorm";
import { Logger } from "../../app/logger.js";
import { resolveDatabaseKind } from "./datasource-options.js";

/**
 * Ensures reseller_wallet_transactions exists when TypeORM synchronize is off (production).
 */
export async function ensureResellerWalletSchema(dataSource: DataSource): Promise<void> {
  const runner = dataSource.createQueryRunner();
  try {
    const exists = await runner.hasTable("reseller_wallet_transactions");
    if (exists) return;

    const kind = resolveDatabaseKind();
    if (kind === "postgres") {
      await runner.query(`
        CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
          id SERIAL PRIMARY KEY,
          "resellerId" VARCHAR(64) NOT NULL,
          "amountUsd" REAL NOT NULL,
          "balanceAfterUsd" REAL NOT NULL,
          type VARCHAR(32) NOT NULL,
          "serviceId" INTEGER,
          vmid INTEGER,
          detail VARCHAR(256),
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);
      await runner.query(`
        CREATE INDEX IF NOT EXISTS idx_reseller_wallet_reseller
        ON reseller_wallet_transactions ("resellerId");
      `);
    } else {
      await runner.query(`
        CREATE TABLE IF NOT EXISTS reseller_wallet_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          resellerId VARCHAR(64) NOT NULL,
          amountUsd REAL NOT NULL,
          balanceAfterUsd REAL NOT NULL,
          type VARCHAR(32) NOT NULL,
          serviceId INTEGER,
          vmid INTEGER,
          detail VARCHAR(256),
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
      await runner.query(`
        CREATE INDEX IF NOT EXISTS idx_reseller_wallet_reseller
        ON reseller_wallet_transactions (resellerId);
      `);
    }
    Logger.info("[Reseller API] created table reseller_wallet_transactions");
  } finally {
    await runner.release();
  }
}
