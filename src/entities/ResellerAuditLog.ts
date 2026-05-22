import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("reseller_audit_log")
export default class ResellerAuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "varchar", length: 64, nullable: true })
  resellerId!: string | null;

  @Column({ type: "integer", nullable: true })
  actorUserId!: number | null;

  @Column({ type: "integer", nullable: true })
  actorTelegramId!: number | null;

  @Column({ type: "varchar", length: 64 })
  action!: string;

  @Column({ type: "varchar", length: 512, nullable: true })
  detail!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  targetType!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  targetId!: string | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  ip!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
