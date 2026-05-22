import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum ResellerApiKeyType {
  Production = "production",
  Test = "test",
  Temporary = "temporary",
  Emergency = "emergency",
  ReadOnly = "read_only",
}

export enum ResellerApiKeyStatus {
  Active = "active",
  Revoked = "revoked",
  Suspended = "suspended",
}

@Entity("reseller_api_keys")
export default class ResellerApiKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "varchar", length: 64 })
  resellerId!: string;

  @Column({ type: "varchar", length: 24, default: ResellerApiKeyType.Production })
  keyType!: ResellerApiKeyType;

  @Column({ type: "varchar", length: 24, default: ResellerApiKeyStatus.Active })
  status!: ResellerApiKeyStatus;

  /** Public prefix shown in admin UI, e.g. rh_live_abcd1234 */
  @Column({ type: "varchar", length: 32 })
  keyPrefix!: string;

  /** SHA-256 hex of full API key. */
  @Index()
  @Column({ type: "varchar", length: 64 })
  keyHash!: string;

  @Column({ type: "simple-json", nullable: true })
  scopes!: string[] | null;

  @Column({ type: "simple-json", nullable: true })
  ipWhitelist!: string[] | null;

  @Column({ type: "integer", default: 120 })
  rateLimitPerMinute!: number;

  @Column({ type: "datetime", nullable: true })
  expiresAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  lastUsedIp!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
