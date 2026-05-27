/**
 * SQLite path resolution and connection pragmas (WAL, busy_timeout).
 *
 * @module infrastructure/db/sqlite-config
 */

import path from "path";
import type Database from "better-sqlite3";

/** Default DB file; override with DATABASE_PATH (e.g. data/data.db in Docker). */
export function resolveSqliteDatabasePath(): string {
  const fromEnv = process.env.DATABASE_PATH?.trim();
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  return path.resolve(process.cwd(), "data.db");
}

/** Apply pragmas on every better-sqlite3 connection (TypeORM + one-off scripts). */
export function applySqlitePragmas(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 30000");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
}

export function isSqliteBusyError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes("database is locked") ||
    msg.includes("sqlite_busy") ||
    error.name === "SqliteError"
  );
}

/** Retry transient SQLITE_BUSY / database locked (concurrent writers). */
export async function withSqliteBusyRetry<T>(
  fn: () => Promise<T>,
  attempts = 6
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (!isSqliteBusyError(error) || i === attempts - 1) {
        throw error;
      }
      await new Promise((r) => setTimeout(r, 75 * (i + 1)));
    }
  }
  throw last;
}
