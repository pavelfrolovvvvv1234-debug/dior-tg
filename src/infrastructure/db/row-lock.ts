/**
 * Row-level pessimistic locks (PostgreSQL only). SQLite serializes writes per transaction.
 *
 * @module infrastructure/db/row-lock
 */

import { resolveDatabaseKind } from "./datasource-options.js";

type PessimisticWriteLock = { lock: { mode: "pessimistic_write" } };

/** Spread into `findOne` / repository options inside an active transaction. */
export function pessimisticWriteLock(): PessimisticWriteLock | Record<string, never> {
  if (resolveDatabaseKind() === "postgres") {
    return { lock: { mode: "pessimistic_write" } };
  }
  return {};
}
