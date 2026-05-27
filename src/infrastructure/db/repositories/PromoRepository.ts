/**
 * Promo repository for promo code management.
 *
 * @module infrastructure/db/repositories/PromoRepository
 */

import { DataSource } from "typeorm";
import Promo from "../../../entities/Promo";
import { BaseRepository } from "./base";
import { BusinessError } from "../../../shared/errors/index";
import { applyPromoCodeInTransaction } from "../../../shared/promo/apply-promo-code.js";

/**
 * Promo repository with promo code-specific operations.
 */
export class PromoRepository extends BaseRepository<Promo> {
  constructor(dataSource: DataSource) {
    super(dataSource, Promo);
  }

  /**
   * Find promo by code (case-insensitive).
   */
  async findByCode(code: string): Promise<Promo | null> {
    const normalizedCode = code.toLowerCase().trim();
    return this.repository.findOne({
      where: { code: normalizedCode },
    });
  }

  /**
   * Check if promo code can be used by user.
   */
  async canUsePromo(code: string, userId: number): Promise<boolean> {
    const promo = await this.findByCode(code);
    if (!promo) return false;
    if (promo.uses >= promo.maxUses) return false;
    if (promo.users.includes(userId)) return false;
    return true;
  }

  /**
   * Mark promo as used for user. Returns discount percent (does not update User — use promocode-input).
   */
  async applyPromo(
    code: string,
    userId: number,
    transaction?: DataSource
  ): Promise<number> {
    const run = async (manager: import("typeorm").EntityManager) => {
      const applied = await applyPromoCodeInTransaction(manager, code, userId);
      if (!applied) {
        throw new BusinessError("Promo code not found or not available");
      }
      return applied.percent;
    };

    if (transaction) {
      return transaction.transaction(run);
    }
    return this.dataSource.transaction(run);
  }
}
