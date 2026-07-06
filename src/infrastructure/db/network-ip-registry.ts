/**
 * Shared IP registry DB connection (same database as web billing).
 *
 * @module infrastructure/db/network-ip-registry
 */

import { DataSource } from "typeorm";
import { Logger } from "../../app/logger.js";
import NetworkIpAllocation from "../../entities/NetworkIpAllocation.js";
import { NetworkIpRegistry } from "../../domain/network/NetworkIpRegistry.js";
import { resolveDatabaseKind } from "./datasource-options.js";

let sharedIpDataSource: DataSource | null = null;
let sharedIpRegistry: NetworkIpRegistry | null = null;

function resolveSharedIpDatabaseUrl(): string {
  return (
    process.env.SHARED_IP_DATABASE_URL?.trim() ||
    process.env.BILLING_DATABASE_URL?.trim() ||
    ""
  );
}

function detectDriver(url: string): "postgres" | "mysql" | null {
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "postgres";
  if (url.startsWith("mysql://") || url.startsWith("mariadb://")) return "mysql";
  return null;
}

async function sharedIpTableExists(dataSource: DataSource): Promise<boolean> {
  const driver = dataSource.options.type;
  if (driver === "postgres") {
    const rows: Array<{ exists: boolean }> = await dataSource.query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = current_schema() AND table_name = 'network_ip_allocations'
       ) AS "exists"`
    );
    return Boolean(rows[0]?.exists);
  }
  if (driver === "mysql") {
    const rows: Array<{ cnt: number }> = await dataSource.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'network_ip_allocations'`
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }
  return false;
}

async function ensureSharedIpTable(dataSource: DataSource): Promise<void> {
  if (await sharedIpTableExists(dataSource)) return;

  throw new Error(
    "network_ip_allocations table is missing in the shared database. " +
      "Create it on the billing MySQL (Docker) as root — see migrations/20260627_network_ip_allocations.mysql.sql"
  );
}

export async function getSharedIpDataSource(): Promise<DataSource | null> {
  if (sharedIpDataSource?.isInitialized) return sharedIpDataSource;

  let url = resolveSharedIpDatabaseUrl();
  if (!url && resolveDatabaseKind() === "postgres") {
    url = process.env.DATABASE_URL?.trim() ?? "";
  }
  if (!url) return null;

  const driver = detectDriver(url);
  if (!driver) {
    Logger.warn(
      "Shared IP registry disabled: SHARED_IP_DATABASE_URL must be postgres:// or mysql://"
    );
    return null;
  }

  sharedIpDataSource = new DataSource({
    type: driver,
    url,
    entities: [NetworkIpAllocation],
    synchronize: false,
    logging: process.env.TYPEORM_LOGGING === "true",
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await sharedIpDataSource.initialize();
  await ensureSharedIpTable(sharedIpDataSource);
  Logger.info("Shared IP registry database connected", { driver });
  return sharedIpDataSource;
}

export async function getNetworkIpRegistry(): Promise<NetworkIpRegistry | null> {
  if (sharedIpRegistry) return sharedIpRegistry;
  const ds = await getSharedIpDataSource();
  if (!ds) return null;
  sharedIpRegistry = new NetworkIpRegistry(ds);
  return sharedIpRegistry;
}

export function isSharedIpRegistryRequired(): boolean {
  const raw = (process.env.PROXMOX_REQUIRE_SHARED_IP_REGISTRY ?? "0").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}
