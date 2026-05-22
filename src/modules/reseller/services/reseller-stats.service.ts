import { IsNull, Not, type DataSource } from "typeorm";
import VirtualDedicatedServer from "../../../entities/VirtualDedicatedServer.js";
import Reseller from "../../../entities/Reseller.js";

export type ResellerServiceStats = {
  serviceCount: number;
  activeCount: number;
  monthlyRevenue: number;
  uniqueClients: number;
};

export type PlatformResellerOverview = {
  resellerRecords: number;
  legacyResellerIds: number;
  totalServices: number;
  activeServices: number;
  totalMrr: number;
  topByMrr: Array<{ resellerId: string; stats: ResellerServiceStats }>;
};

export class ResellerStatsService {
  constructor(private readonly dataSource: DataSource) {}

  async getServiceStats(resellerId: string): Promise<ResellerServiceStats> {
    const services = await this.dataSource.getRepository(VirtualDedicatedServer).find({
      where: { resellerId },
    });
    const clients = new Set(
      services.map((s) => s.resellerClientId).filter((c): c is string => Boolean(c))
    );
    return {
      serviceCount: services.length,
      activeCount: services.filter((s) => !s.adminBlocked && !s.managementLocked).length,
      monthlyRevenue: services.reduce((sum, s) => sum + Number(s.renewalPrice || 0), 0),
      uniqueClients: clients.size,
    };
  }

  async getPlatformOverview(): Promise<PlatformResellerOverview> {
    const vdsRepo = this.dataSource.getRepository(VirtualDedicatedServer);
    const services = await vdsRepo.find({
      where: { resellerId: Not(IsNull()) },
      take: 5000,
    });

    const byReseller = new Map<string, ResellerServiceStats>();
    for (const s of services) {
      const rid = String(s.resellerId);
      const prev = byReseller.get(rid) ?? {
        serviceCount: 0,
        activeCount: 0,
        monthlyRevenue: 0,
        uniqueClients: 0,
      };
      prev.serviceCount += 1;
      if (!s.adminBlocked && !s.managementLocked) prev.activeCount += 1;
      prev.monthlyRevenue += Number(s.renewalPrice || 0);
      byReseller.set(rid, prev);
    }

    for (const [rid, stats] of byReseller) {
      const list = await vdsRepo.find({ where: { resellerId: rid }, select: ["resellerClientId"] });
      stats.uniqueClients = new Set(
        list.map((x) => x.resellerClientId).filter((c): c is string => Boolean(c))
      ).size;
      byReseller.set(rid, stats);
    }

    const dbCount = await this.dataSource.getRepository(Reseller).count();
    const legacyIds = new Set(services.map((s) => String(s.resellerId)));
    const topByMrr = [...byReseller.entries()]
      .sort((a, b) => b[1].monthlyRevenue - a[1].monthlyRevenue)
      .slice(0, 10)
      .map(([resellerId, stats]) => ({ resellerId, stats }));

    return {
      resellerRecords: dbCount,
      legacyResellerIds: legacyIds.size,
      totalServices: services.length,
      activeServices: services.filter((s) => !s.adminBlocked && !s.managementLocked).length,
      totalMrr: services.reduce((sum, s) => sum + Number(s.renewalPrice || 0), 0),
      topByMrr,
    };
  }
}
