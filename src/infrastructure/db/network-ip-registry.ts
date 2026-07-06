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

async function ensureSharedIpTable(dataSource: DataSource): Promise<void> {
  const driver = dataSource.options.type;
  if (driver === "postgres") {
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS network_ip_allocations (
        id SERIAL PRIMARY KEY,
        ip VARCHAR(15) NOT NULL UNIQUE,
        network VARCHAR(43) NOT NULL,
        owner VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'reserved',
        vmid INTEGER NULL,
        "externalServiceId" VARCHAR(64) NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "releasedAt" TIMESTAMP NULL
      );
      CREATE INDEX IF NOT EXISTS idx_network_ip_allocations_network ON network_ip_allocations (network);
      CREATE INDEX IF NOT EXISTS idx_network_ip_allocations_vmid ON network_ip_allocations (vmid);
    `);
    return;
  }

  if (driver === "mysql") {
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS network_ip_allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ip VARCHAR(15) NOT NULL,
        network VARCHAR(43) NOT NULL,
        owner VARCHAR(32) NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'reserved',
        vmid INT NULL,
        externalServiceId VARCHAR(64) NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        releasedAt DATETIME NULL,
        UNIQUE KEY uq_network_ip_allocations_ip (ip),
        KEY idx_network_ip_allocations_network (network),
        KEY idx_network_ip_allocations_vmid (vmid)
      ) ENGINE=InnoDB;
    `);
  }
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
