import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export enum ResellerStatus {
  Pending = "pending",
  Active = "active",
  Suspended = "suspended",
}

export enum ResellerPlan {
  Starter = "starter",
  Pro = "pro",
  Enterprise = "enterprise",
}

@Entity("resellers")
export default class Reseller {
  @PrimaryColumn({ type: "varchar", length: 64 })
  id!: string;

  @Index()
  @Column({ type: "varchar", length: 128, nullable: true })
  displayName!: string | null;

  @Index()
  @Column({ type: "integer", nullable: true })
  telegramId!: number | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  telegramUsername!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  email!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  company!: string | null;

  @Column({ type: "varchar", length: 24, default: ResellerStatus.Active })
  status!: ResellerStatus;

  @Column({ type: "varchar", length: 24, default: ResellerPlan.Starter })
  plan!: ResellerPlan;

  @Column({ type: "real", default: 0 })
  balance!: number;

  @Column({ type: "real", default: 15 })
  profitPercent!: number;

  @Column({ type: "integer", default: 10 })
  maxVps!: number;

  @Column({ type: "integer", default: 120 })
  apiRatePerMinute!: number;

  @Column({ type: "integer", default: 0 })
  abuseScore!: number;

  @Column({ type: "varchar", length: 32, nullable: true })
  referralCode!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  webhookUrl!: string | null;

  /** SHA-256 hex of webhook signing secret (never store raw). */
  @Column({ type: "varchar", length: 64, nullable: true })
  webhookSecretHash!: string | null;

  /** SHA-256 hex of API HMAC signing secret. */
  @Column({ type: "varchar", length: 64, nullable: true })
  signingSecretHash!: string | null;

  @Column({ type: "simple-json", nullable: true })
  ipWhitelist!: string[] | null;

  @Column({ type: "simple-json", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: "datetime", nullable: true })
  lastActivityAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
