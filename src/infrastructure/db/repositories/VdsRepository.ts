/**
 * VirtualDedicatedServer repository for VDS management.
 *
 * @module infrastructure/db/repositories/VdsRepository
 */

import { Brackets, DataSource, LessThanOrEqual } from "typeorm";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer";
import User from "../../../entities/User.js";
import { BaseRepository } from "./base";
import { NotFoundError } from "../../../shared/errors/index";

/**
 * VDS repository with VDS-specific operations.
 */
export class VdsRepository extends BaseRepository<VirtualDedicatedServer> {
  constructor(dataSource: DataSource) {
    super(dataSource, VirtualDedicatedServer);
  }

  /**
   * Find VDS by VMManager ID.
   */
  async findByVdsId(vdsId: number): Promise<VirtualDedicatedServer | null> {
    return this.repository.findOne({
      where: { vdsId },
    });
  }

  /**
   * Find all VDS for a user.
   */
  async findByUserId(userId: number): Promise<VirtualDedicatedServer[]> {
    return this.repository.find({
      where: { targetUserId: userId },
      order: { createdAt: "DESC" },
    });
  }

  /**
   * Find expired VDS (expireAt <= now).
   */
  async findExpired(): Promise<VirtualDedicatedServer[]> {
    return this.repository.find({
      where: {
        expireAt: LessThanOrEqual(new Date()),
      },
    });
  }

  /**
   * Admin list with optional search by id, IP, name, rate, or owner (@username / user id).
   */
  async findPaginatedForAdmin(
    skip: number,
    take: number,
    search?: string,
    ownerUserIds?: number[] | null
  ): Promise<[VirtualDedicatedServer[], number]> {
    const ownerIds = (ownerUserIds ?? []).filter((id) => Number.isInteger(id) && id > 0);
    if (ownerIds.length > 0) {
      const allForOwners = await this.repository
        .createQueryBuilder("v")
        .where("v.targetUserId IN (:...ownerIds)", { ownerIds })
        .orderBy("v.id", "DESC")
        .getMany();
      return [allForOwners, allForOwners.length];
    }

    const qb = this.repository.createQueryBuilder("v");
    const trimmed = search?.trim();
    if (trimmed) {
      const q = `%${trimmed}%`;
      const usernameNeedle = trimmed.replace(/^@+/, "").toLowerCase();
      const userLike =
        usernameNeedle.length >= 2 && /^[a-z0-9_]+$/i.test(usernameNeedle)
          ? `%${usernameNeedle}%`
          : null;

      qb.leftJoin(User, "u", "u.id = v.targetUserId");
      qb.where(
        new Brackets((w) => {
          w.where("CAST(v.id AS TEXT) LIKE :q", { q })
            .orWhere("CAST(v.vdsId AS TEXT) LIKE :q", { q })
            .orWhere("v.ipv4Addr LIKE :q", { q })
            .orWhere("COALESCE(v.displayName, '') LIKE :q", { q })
            .orWhere("v.rateName LIKE :q", { q })
            .orWhere("CAST(v.targetUserId AS TEXT) LIKE :q", { q })
            .orWhere("CAST(u.telegramId AS TEXT) LIKE :q", { q })
            .orWhere("CAST(u.id AS TEXT) LIKE :q", { q });
          if (userLike) {
            w.orWhere("LOWER(COALESCE(u.telegramUsername, '')) LIKE :userLike", { userLike });
          }
        })
      );
    }
    qb.orderBy("v.id", "DESC").skip(skip).take(take);
    return qb.getManyAndCount();
  }

  /**
   * Find VDS expiring soon (within days).
   */
  async findExpiringSoon(days: number): Promise<VirtualDedicatedServer[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.repository.find({
      where: {
        expireAt: LessThanOrEqual(futureDate),
      },
    });
  }

  /**
   * Update VDS expiration date.
   */
  async updateExpiration(
    vdsId: number,
    expireAt: Date
  ): Promise<VirtualDedicatedServer> {
    const vds = await this.findById(vdsId);
    if (!vds) {
      throw new NotFoundError("VirtualDedicatedServer", vdsId);
    }
    vds.expireAt = expireAt;
    return this.save(vds);
  }

  /**
   * Set pay day (when VDS will be deleted if not paid).
   */
  async setPayDay(
    vdsId: number,
    payDayAt: Date | null
  ): Promise<VirtualDedicatedServer> {
    const vds = await this.findById(vdsId);
    if (!vds) {
      throw new NotFoundError("VirtualDedicatedServer", vdsId);
    }
    vds.payDayAt = payDayAt;
    return this.save(vds);
  }
}
