/**
 * TypeORM DataSource options (SQLite or PostgreSQL via DATABASE_URL).
 *
 * @module infrastructure/db/datasource-options
 */

import type { DataSourceOptions } from "typeorm";
import { applySqlitePragmas, resolveSqliteDatabasePath } from "./sqlite-config.js";
import { appEntities } from "./entities-registry.js";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** Schema sync: off in production unless TYPEORM_SYNCHRONIZE=true explicitly. */
export function shouldSynchronizeSchema(): boolean {
  const explicit = process.env.TYPEORM_SYNCHRONIZE?.trim().toLowerCase();
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return !isProduction();
}

export function resolveDatabaseKind(): "postgres" | "sqlite" {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgres";
  }
  return "sqlite";
}

export function buildDataSourceOptions(): DataSourceOptions {
  const synchronize = shouldSynchronizeSchema();
  const logging = process.env.TYPEORM_LOGGING === "true";

  if (resolveDatabaseKind() === "postgres") {
    return {
      type: "postgres",
      url: process.env.DATABASE_URL!.trim(),
      synchronize,
      logging,
      entities: appEntities,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    };
  }

  return {
    type: "better-sqlite3",
    database: resolveSqliteDatabasePath(),
    synchronize,
    logging,
    entities: appEntities,
    enableWAL: true,
    prepareDatabase: applySqlitePragmas,
  };
}
