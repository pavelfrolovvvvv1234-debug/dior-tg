import type { DataSource } from "typeorm";
import ResellerAuditLog from "../../../entities/ResellerAuditLog.js";

export type ResellerAuditInput = {
  resellerId?: string | null;
  actorUserId?: number | null;
  actorTelegramId?: number | null;
  action: string;
  detail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ip?: string | null;
};

export class ResellerAuditService {
  constructor(private readonly dataSource: DataSource) {}

  async log(input: ResellerAuditInput): Promise<void> {
    const row = new ResellerAuditLog();
    row.resellerId = input.resellerId ?? null;
    row.actorUserId = input.actorUserId ?? null;
    row.actorTelegramId = input.actorTelegramId ?? null;
    row.action = input.action;
    row.detail = input.detail ?? null;
    row.targetType = input.targetType ?? null;
    row.targetId = input.targetId ?? null;
    row.ip = input.ip ?? null;
    await this.dataSource.getRepository(ResellerAuditLog).save(row);
  }

  async listRecent(page: number, pageSize = 15): Promise<{ rows: ResellerAuditLog[]; total: number }> {
    const repo = this.dataSource.getRepository(ResellerAuditLog);
    const [rows, total] = await repo.findAndCount({
      order: { id: "DESC" },
      skip: page * pageSize,
      take: pageSize,
    });
    return { rows, total };
  }
}
