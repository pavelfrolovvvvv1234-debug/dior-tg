/**
 * Atomic IPv4 reservations shared with web billing (same DB table).
 *
 * @module domain/network/NetworkIpRegistry
 */

import { DataSource, In, QueryFailedError, type EntityManager } from "typeorm";
import { Logger } from "../../app/logger.js";
import NetworkIpAllocation, {
  type NetworkIpOwner,
  type NetworkIpStatus,
} from "../../entities/NetworkIpAllocation.js";
import { getProxmoxNetworkEnv } from "../../app/config.js";
import {
  buildIpConfig0,
  pickFreeIpv4Candidate,
} from "../../shared/proxmox/ip-allocation.js";

export type ReservedNetworkIp = {
  ip: string;
  ipconfig0: string;
  nameserver: string;
  allocationId: number;
};

function pessimisticWriteLockForDataSource(
  dataSource: DataSource
): { lock: { mode: "pessimistic_write" } } | Record<string, never> {
  const driver = dataSource.options.type;
  if (driver === "postgres" || driver === "mysql") {
    return { lock: { mode: "pessimistic_write" } };
  }
  return {};
}

export class NetworkIpRegistry {
  constructor(private readonly dataSource: DataSource) {}

  async listUsedIps(network: string): Promise<Set<string>> {
    const rows = await this.dataSource.getRepository(NetworkIpAllocation).find({
      where: { network, status: In(["reserved", "active"] satisfies NetworkIpStatus[]) },
      select: ["ip"],
    });
    return new Set(rows.map((row) => row.ip));
  }

  async reserve(args: {
    network: string;
    gateway: string;
    externalUsedIps: Set<string>;
    owner: NetworkIpOwner;
    vmid?: number;
    externalServiceId?: string;
    ipStart?: number;
    ipEnd?: number;
  }): Promise<ReservedNetworkIp | null> {
    const envNetwork = getProxmoxNetworkEnv();
    const ipStart = args.ipStart ?? envNetwork.ipStart;
    const ipEnd = args.ipEnd ?? envNetwork.ipEnd;
    const nameserver = envNetwork.nameserver;

    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        return await this.dataSource.transaction(async (manager) => {
          const dbUsed = await this.loadUsedIpsLocked(manager, args.network);
          const mergedUsed = new Set<string>([...dbUsed, ...args.externalUsedIps]);
          const candidate = pickFreeIpv4Candidate({
            cidr: args.network,
            gateway: args.gateway,
            usedIps: mergedUsed,
            ipStart,
            ipEnd,
          });
          if (!candidate) return null;

          const releasedRow = await manager.findOne(NetworkIpAllocation, {
            where: { ip: candidate, status: "released" },
          });
          if (releasedRow) {
            releasedRow.network = args.network;
            releasedRow.owner = args.owner;
            releasedRow.status = "reserved";
            releasedRow.vmid = args.vmid ?? null;
            releasedRow.externalServiceId = args.externalServiceId ?? null;
            releasedRow.releasedAt = null;
            const saved = await manager.save(releasedRow);
            return {
              ip: candidate,
              ipconfig0: buildIpConfig0(candidate, args.network, args.gateway),
              nameserver,
              allocationId: saved.id,
            };
          }

          const row = manager.create(NetworkIpAllocation, {
            ip: candidate,
            network: args.network,
            owner: args.owner,
            status: "reserved",
            vmid: args.vmid ?? null,
            externalServiceId: args.externalServiceId ?? null,
            releasedAt: null,
          });
          const saved = await manager.save(row);
          return {
            ip: candidate,
            ipconfig0: buildIpConfig0(candidate, args.network, args.gateway),
            nameserver,
            allocationId: saved.id,
          };
        });
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          Logger.warn(`NetworkIpRegistry.reserve: IP race on attempt ${attempt + 1}, retrying`);
          continue;
        }
        throw error;
      }
    }

    return null;
  }

  async activate(ip: string, vmid?: number): Promise<void> {
    await this.dataSource.getRepository(NetworkIpAllocation).update(
      { ip, status: In(["reserved", "active"]) },
      { status: "active", vmid: vmid ?? null, releasedAt: null }
    );
  }

  async releaseByIp(ip: string): Promise<void> {
    if (!ip.trim()) return;
    await this.dataSource.getRepository(NetworkIpAllocation).update(
      { ip, status: In(["reserved", "active"]) },
      { status: "released", releasedAt: new Date() }
    );
  }

  async releaseByVmid(vmid: number): Promise<void> {
    await this.dataSource.getRepository(NetworkIpAllocation).update(
      { vmid, status: In(["reserved", "active"]) },
      { status: "released", releasedAt: new Date() }
    );
  }

  /** Register an IP already in use on Proxmox (backfill / guest-agent) without allocating a new one. */
  async upsertActive(args: {
    ip: string;
    network: string;
    owner: NetworkIpOwner;
    vmid?: number;
  }): Promise<void> {
    const repo = this.dataSource.getRepository(NetworkIpAllocation);
    const existing = await repo.findOne({ where: { ip: args.ip } });
    if (existing) {
      if (existing.status === "released" || existing.status === "reserved" || existing.status === "active") {
        await repo.update(existing.id, {
          network: args.network,
          owner: args.owner,
          status: "active",
          vmid: args.vmid ?? existing.vmid,
          releasedAt: null,
        });
      }
      return;
    }
    await repo.save(
      repo.create({
        ip: args.ip,
        network: args.network,
        owner: args.owner,
        status: "active",
        vmid: args.vmid ?? null,
        releasedAt: null,
      })
    );
  }

  private async loadUsedIpsLocked(manager: EntityManager, network: string): Promise<Set<string>> {
    const rows = await manager.find(NetworkIpAllocation, {
      where: { network, status: In(["reserved", "active"]) },
      select: ["ip"],
      ...pessimisticWriteLockForDataSource(this.dataSource),
    });
    return new Set(rows.map((row) => row.ip));
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string; errno?: number };
    return driverError?.code === "23505" || driverError?.errno === 1062;
  }
}
