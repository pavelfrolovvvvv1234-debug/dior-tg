/**
 * Anti-spam: commercial limits + daily cap.
 *
 * @module modules/notifications/policies/anti-spam.service
 */

import type { DataSource } from "typeorm";
import { OfferEngine } from "../../growth/offer.engine.js";
import NotificationDelivery from "../../../entities/notifications/NotificationDelivery.js";
import { getCatalogEntry } from "../templates/template-catalog.js";

const MAX_COMMERCIAL_PER_DAY = 2;
const MAX_TOTAL_PER_DAY = 5;

export class AntiSpamService {
  private readonly offerEngine: OfferEngine;

  constructor(private readonly dataSource: DataSource) {
    this.offerEngine = new OfferEngine();
  }

  async evaluate(
    userId: number,
    templateKey: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    const entry = getCatalogEntry(templateKey);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const repo = this.dataSource.getRepository(NotificationDelivery);
    const recent = await repo
      .createQueryBuilder("d")
      .where("d.userId = :userId", { userId })
      .andWhere("d.sentAt >= :since", { since })
      .andWhere("d.status = :status", { status: "sent" })
      .getCount();

    if (recent >= MAX_TOTAL_PER_DAY) {
      return { allowed: false, reason: "daily_cap" };
    }

    if (!entry?.commercial) {
      return { allowed: true };
    }

    const commercialRecent = await repo.find({
      where: { userId, status: "sent" },
      order: { sentAt: "DESC" },
      take: MAX_COMMERCIAL_PER_DAY + 2,
    });
    let commercialToday = 0;
    for (const d of commercialRecent) {
      if (d.sentAt < since) break;
      const t = getCatalogEntry(d.templateKey);
      if (t?.commercial) commercialToday++;
    }
    if (commercialToday >= MAX_COMMERCIAL_PER_DAY) {
      return { allowed: false, reason: "commercial_daily_cap" };
    }

    const canCommercial = await this.offerEngine.canSendCommercialPush(userId);
    if (!canCommercial) {
      return { allowed: false, reason: "commercial_72h" };
    }

    return { allowed: true };
  }

  async markCommercialSent(userId: number, templateKey: string): Promise<void> {
    const entry = getCatalogEntry(templateKey);
    if (entry?.commercial) {
      await this.offerEngine.markCommercialPushSent(userId);
    }
  }
}
