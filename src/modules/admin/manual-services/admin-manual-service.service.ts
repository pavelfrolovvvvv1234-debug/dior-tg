/**
 * Persist manually provisioned services (admin wizard).
 *
 * @module modules/admin/manual-services/admin-manual-service.service
 */

import type { DataSource } from "typeorm";
import DomainServiceEntity from "../../../entities/DomainService.js";
import VirtualDedicatedServer, {
  generatePassword,
} from "../../../entities/VirtualDedicatedServer.js";
import DedicatedServer, {
  DedicatedServerStatus,
} from "../../../entities/DedicatedServer.js";
import { VdsRepository } from "../../../infrastructure/db/repositories/VdsRepository.js";
import { UserRepository } from "../../../infrastructure/db/repositories/UserRepository.js";
import { NotFoundError } from "../../../shared/errors/index.js";
import {
  dedicatedServiceSchema,
  domainServiceSchema,
  parseFlexibleDate,
  splitDomainFqdn,
  vdsServiceSchema,
} from "./schemas.js";
import type {
  AdminManualServiceCreateResult,
  AdminManualServiceType,
  DedicatedServiceDraft,
  DomainServiceDraft,
  VdsServiceDraft,
} from "./types.js";

export class AdminManualServiceService {
  constructor(private readonly dataSource: DataSource) {}

  async createDomain(
    userId: number,
    raw: DomainServiceDraft
  ): Promise<AdminManualServiceCreateResult> {
    const parsed = domainServiceSchema.parse(raw);
    const userRepo = new UserRepository(this.dataSource);
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("User", userId);

    const { domain, tld } = splitDomainFqdn(parsed.domain);
    const fqdn = `${domain}.${tld}`;
    const expireAt = parseFlexibleDate(parsed.expiresAt);
    const nsParts = [parsed.ns1, parsed.ns2].filter((n) => n && n.trim().length > 0);
    const noteLine = parsed.notes?.trim() ? `notes:${parsed.notes.trim()}` : "";
    const nameservers =
      nsParts.length > 0
        ? [nsParts.join("\n"), noteLine].filter(Boolean).join("\n")
        : [ `manual:${parsed.registrar}`, noteLine].filter(Boolean).join("\n");

    const repo = this.dataSource.getRepository(DomainServiceEntity);
    const existing = await repo.findOne({ where: { domain: fqdn } });
    if (existing) {
      throw new Error(`Domain already exists: ${fqdn}`);
    }

    const row = repo.create({
      domain: fqdn,
      zone: tld,
      nameservers,
      target_user_id: user.id,
      expire_at: expireAt,
      payday_at: expireAt,
    });
    const saved = await repo.save(row);

    return {
      serviceType: "domain",
      serviceId: saved.id,
      userId: user.id,
      summary: `Domain ${fqdn} → user #${user.id}`,
    };
  }

  async createVds(
    userId: number,
    raw: VdsServiceDraft
  ): Promise<AdminManualServiceCreateResult> {
    const parsed = vdsServiceSchema.parse(raw);
    const userRepo = new UserRepository(this.dataSource);
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("User", userId);

    const vdsRepo = new VdsRepository(this.dataSource);
    const vmid = parsed.vmid ?? (await this.allocateManualVmid(vdsRepo));
    const existing = await vdsRepo.findByVdsId(vmid);
    if (existing) {
      throw new Error(`VMID ${vmid} is already used`);
    }

    const entity = new VirtualDedicatedServer();
    entity.vdsId = vmid;
    entity.login = parsed.login;
    entity.password = parsed.password;
    entity.ipv4Addr = parsed.ipv4;
    entity.cpuCount = parsed.cpuCount;
    entity.networkSpeed = 1000;
    entity.isBulletproof = true;
    entity.payDayAt = null;
    entity.ramSize = parsed.ramGb;
    entity.diskSize = parsed.diskGb;
    entity.lastOsId = 900;
    entity.rateName = parsed.rateName;
    entity.expireAt = parseFlexibleDate(parsed.expireAt);
    entity.targetUserId = user.id;
    entity.renewalPrice = parsed.renewalPrice;
    let displayLabel = [parsed.provider, parsed.osLabel].filter(Boolean).join(" · ");
    if (parsed.notes?.trim()) {
      displayLabel += ` — ${parsed.notes.trim().slice(0, 48)}`;
    }
    entity.displayName = displayLabel.slice(0, 120);
    entity.bundleType = null;
    entity.autoRenewEnabled = false;
    entity.adminBlocked = false;
    entity.managementLocked = false;
    entity.extraIpv4Count = 0;
    entity.resellerId = null;
    entity.resellerClientId = null;

    const saved = await vdsRepo.save(entity);

    const noteSuffix = parsed.notes?.trim()
      ? ` · notes: ${parsed.notes.trim().slice(0, 80)}`
      : "";
    const sshSuffix =
      parsed.sshPort != null ? ` · SSH :${parsed.sshPort}` : "";

    return {
      serviceType: "vds",
      serviceId: saved.id,
      userId: user.id,
      summary: `VDS #${saved.id} VMID ${vmid} ${parsed.ipv4} → user #${user.id}${sshSuffix}${noteSuffix}`,
    };
  }

  async createDedicated(
    userId: number,
    raw: DedicatedServiceDraft
  ): Promise<AdminManualServiceCreateResult> {
    const parsed = dedicatedServiceSchema.parse(raw);
    const userRepo = new UserRepository(this.dataSource);
    const user = await userRepo.findById(userId);
    if (!user) throw new NotFoundError("User", userId);

    const credentials = JSON.stringify({
      ip: parsed.ipv4,
      login: parsed.login,
      password: parsed.password,
      provider: parsed.provider,
      rackLocation: parsed.rackLocation,
      hardwareInfo: parsed.hardwareInfo,
      notes: parsed.notes ?? null,
      os: null,
    });

    const repo = this.dataSource.getRepository(DedicatedServer);
    const row = repo.create({
      userId: user.id,
      label: `${parsed.provider} · ${parsed.ipv4}`.slice(0, 120),
      status: DedicatedServerStatus.ACTIVE,
      ticketId: null,
      credentials,
      paidUntil: parsed.paidUntil ? parseFlexibleDate(parsed.paidUntil) : null,
      monthlyPrice: parsed.monthlyPrice ?? null,
    });
    const saved = await repo.save(row);

    return {
      serviceType: "dedicated",
      serviceId: saved.id,
      userId: user.id,
      summary: `Dedicated #${saved.id} ${parsed.ipv4} → user #${user.id}`,
    };
  }

  async create(
    type: AdminManualServiceType,
    userId: number,
    draft: DomainServiceDraft | VdsServiceDraft | DedicatedServiceDraft
  ): Promise<AdminManualServiceCreateResult> {
    switch (type) {
      case "domain":
        return this.createDomain(userId, draft as DomainServiceDraft);
      case "vds":
        return this.createVds(userId, draft as VdsServiceDraft);
      case "dedicated":
        return this.createDedicated(userId, draft as DedicatedServiceDraft);
      default: {
        const _exhaustive: never = type;
        throw new Error(`Unknown service type: ${String(_exhaustive)}`);
      }
    }
  }

  private async allocateManualVmid(vdsRepo: VdsRepository): Promise<number> {
    const rows = await this.dataSource
      .getRepository(VirtualDedicatedServer)
      .createQueryBuilder("v")
      .select("MAX(v.vdsId)", "maxId")
      .getRawOne<{ maxId: string | number | null }>();
    const maxId = Number(rows?.maxId ?? 0);
    const base = Math.max(maxId, 899_999);
    for (let i = 0; i < 50; i++) {
      const candidate = base + 1 + Math.floor(Math.random() * 50_000);
      const taken = await vdsRepo.findByVdsId(candidate);
      if (!taken) return candidate;
    }
    return base + 1;
  }
}

/** Generate a strong password when admin leaves VPS password empty (not used in strict form). */
export function generateManualServicePassword(): string {
  return generatePassword(16);
}
