/**
 * Scheduled campaign orchestration (digest, intel, tips, reactivation, VIP).
 *
 * @module modules/notifications/campaigns/campaign-runner
 */

import type { DataSource } from "typeorm";
import User from "../../../entities/User.js";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import { SegmentService } from "../../growth/segment.service.js";
import type { NotificationQueueService } from "../queue/notification-queue.service.js";
import { EngagementService } from "../engagement/engagement.service.js";
import { Logger } from "../../../app/logger.js";

const MARKET_INTEL: Array<{ ru: string; en: string }> = [
  {
    ru: "Ряд EU-провайдеров ужесточил abuse-policy на edge — растёт доля null-route по отдельным ASN.",
    en: "Several EU providers tightened edge abuse policies — null-route rates rose on select ASNs.",
  },
  {
    ru: "Anti-DDoS landscape: больше провайдеров комбинирует scrubbing + BGP blackholing на transit.",
    en: "Anti-DDoS landscape: more providers combine scrubbing with BGP blackholing on transit.",
  },
  {
    ru: "Тренд: выделенные uplink-пары в CEE снижают latency для Eastern Europe маршрутов.",
    en: "Trend: dedicated uplink pairs in CEE reduce latency for Eastern Europe routes.",
  },
];

const TECH_TIPS: Array<{ ru: string; en: string }> = [
  {
    ru: "DNS: используйте короткий TTL на failover-записях и вторичный NS в другой зоне.",
    en: "DNS: use short TTL on failover records and secondary NS in another region.",
  },
  {
    ru: "Reverse proxy: терминируйте TLS на edge, origin — только private network.",
    en: "Reverse proxy: terminate TLS at edge; keep origin on private network only.",
  },
  {
    ru: "Uptime: health-checks с разных POP + алерт на latency, не только HTTP 200.",
    en: "Uptime: health-checks from multiple POPs; alert on latency, not only HTTP 200.",
  },
  {
    ru: "CDN: cache static at edge; dynamic — origin shield + stale-while-revalidate.",
    en: "CDN: cache static at edge; dynamic — origin shield + stale-while-revalidate.",
  },
];

const WEEKLY_DIGEST_BODY = {
  ru: `• EU: расширен anti-DDoS фильтр на edge
• Новые AMD EPYC пулы в Amsterdam / Warsaw
• Dedicated: ограниченный high-memory stock
• Domain inventory: обновлены .cc / .to зоны`,
  en: `• EU: expanded edge anti-DDoS filtering
• New AMD EPYC pools in Amsterdam / Warsaw
• Dedicated: limited high-memory stock
• Domain inventory: .cc / .to zones refreshed`,
};

export class CampaignRunner {
  private readonly segments: SegmentService;
  private readonly engagement: EngagementService;

  constructor(
    private readonly dataSource: DataSource,
    private readonly queue: NotificationQueueService
  ) {
    this.segments = new SegmentService(dataSource);
    this.engagement = new EngagementService(dataSource);
  }

  async runWeeklyDigest(): Promise<number> {
    const ids = await this.segments.getUserIdsBySegment("active_vps", 500);
    const allUsers = await this.dataSource
      .getRepository(User)
      .createQueryBuilder("u")
      .where("u.isBanned = 0")
      .take(800)
      .getMany();
    const target = new Set([...ids, ...allUsers.map((u) => u.id)]);
    let n = 0;
    for (const userId of target) {
      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
      if (!user) continue;
      const locale = user.lang === "en" ? "en" : "ru";
      const body = WEEKLY_DIGEST_BODY[locale];
      const job = await this.queue.enqueue({
        userId,
        campaignKey: "weekly_digest",
        templateKey: "digest.weekly",
        locale,
        payload: { body, uptime: "99.92%", nodes: "12+" },
        dedupeKey: `weekly:${weekKey()}`,
        priority: 25,
      });
      if (job) n++;
    }
    return n;
  }

  async runMarketIntel(): Promise<number> {
    const users = await this.dataSource.getRepository(User).find({
      where: { isBanned: false },
      take: 400,
      order: { lastUpdateAt: "DESC" },
    });
    const pick = MARKET_INTEL[Math.floor(Date.now() / (72 * 3600_000)) % MARKET_INTEL.length]!;
    let n = 0;
    for (const u of users) {
      const locale = u.lang === "en" ? "en" : "ru";
      const job = await this.queue.enqueue({
        userId: u.id,
        campaignKey: "market_intel",
        templateKey: "intel.operator",
        locale,
        payload: { insight: locale === "en" ? pick.en : pick.ru },
        dedupeKey: `intel:${weekKey()}`,
      });
      if (job) n++;
    }
    return n;
  }

  async runTechTips(): Promise<number> {
    const users = await this.dataSource.getRepository(User).find({
      where: { isBanned: false },
      take: 350,
      order: { lastUpdateAt: "DESC" },
    });
    const pick = TECH_TIPS[Math.floor(Date.now() / (48 * 3600_000)) % TECH_TIPS.length]!;
    let n = 0;
    for (const u of users) {
      const locale = u.lang === "en" ? "en" : "ru";
      const job = await this.queue.enqueue({
        userId: u.id,
        campaignKey: "tech_tip",
        templateKey: "tech.tip",
        locale,
        payload: { tip: locale === "en" ? pick.en : pick.ru },
        dedupeKey: `tip:${weekKey()}`,
      });
      if (job) n++;
    }
    return n;
  }

  async runReactivation14d(): Promise<number> {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const users = await this.dataSource
      .getRepository(User)
      .createQueryBuilder("u")
      .where("u.isBanned = 0")
      .andWhere("u.lastUpdateAt < :cutoff", { cutoff })
      .take(300)
      .getMany();

    const updates = {
      ru: "Новые EU/Asia nodes · обновлён anti-abuse stack · dedicated pool refresh",
      en: "New EU/Asia nodes · updated anti-abuse stack · dedicated pool refresh",
    };

    let n = 0;
    for (const u of users) {
      const hasVds = await this.dataSource.getRepository(VirtualDedicatedServer).count({
        where: { targetUserId: u.id },
      });
      if (hasVds > 0) continue;
      const locale = u.lang === "en" ? "en" : "ru";
      const job = await this.queue.enqueue({
        userId: u.id,
        campaignKey: "reactivation",
        templateKey: "reactivation.14d",
        locale,
        payload: { updates: updates[locale] },
        dedupeKey: `react14:${monthKey()}`,
      });
      if (job) n++;
    }
    return n;
  }

  async runExpansionAndVip(): Promise<number> {
    await this.engagement.refreshAll(400);
    const repo = this.dataSource.getRepository(
      (await import("../../../entities/notifications/UserEngagementProfile.js")).default
    );
    const profiles = await repo.find({ where: { isVip: true }, take: 100 });
    let n = 0;
    for (const p of profiles) {
      const user = await this.dataSource.getRepository(User).findOne({ where: { id: p.userId } });
      if (!user) continue;
      const locale = user.lang === "en" ? "en" : "ru";
      if (p.engagementScore >= 60) {
        const job = await this.queue.enqueue({
          userId: p.userId,
          campaignKey: "expansion",
          templateKey: "expansion.offer",
          locale,
          payload: {
            detail:
              locale === "en"
                ? "Multi-node routing and CDN edge expansion available."
                : "Доступны multi-node routing и расширение CDN edge.",
          },
          dedupeKey: `exp:${monthKey()}`,
        });
        if (job) n++;
      }
      if (p.isVip) {
        const vipJob = await this.queue.enqueue({
          userId: p.userId,
          campaignKey: "vip_alert",
          templateKey: "vip.early_access",
          locale,
          payload: {
            detail:
              locale === "en"
                ? "High-memory dedicated and premium IPv4 pool — priority queue."
                : "High-memory dedicated и premium IPv4 — priority queue.",
          },
          dedupeKey: `vip:${weekKey()}`,
        });
        if (vipJob) n++;
      }
    }
    return n;
  }

  /** Broadcast infrastructure feed to active users (admin-triggered). */
  async broadcastFeed(
    templateKey: string,
    payload: Record<string, string>,
    segment: "all" | "active_vps" = "active_vps"
  ): Promise<number> {
    const ids =
      segment === "all"
        ? (
            await this.dataSource.getRepository(User).find({
              where: { isBanned: false },
              take: 2000,
              select: ["id", "lang"],
            })
          ).map((u) => u.id)
        : await this.segments.getUserIdsBySegment("active_vps", 2000);
    let n = 0;
    for (const userId of ids) {
      const user = await this.dataSource.getRepository(User).findOne({ where: { id: userId } });
      if (!user) continue;
      const job = await this.queue.enqueue({
        userId,
        campaignKey: "infrastructure_feed",
        templateKey,
        locale: user.lang === "en" ? "en" : "ru",
        payload,
        priority: 20,
        dedupeKey: `feed:${templateKey}:${Date.now().toString(36)}:${userId}`,
      });
      if (job) n++;
    }
    Logger.info("[Notifications] Feed broadcast enqueued", { templateKey, n });
    return n;
  }
}

function weekKey(): string {
  const d = new Date();
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86_400_000 + start.getUTCDay() + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}
