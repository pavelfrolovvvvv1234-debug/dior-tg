import { randomUUID } from "crypto";
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export type NetworkIpOwner = "telegram_bot" | "billing" | "manual";
export type NetworkIpStatus = "reserved" | "active" | "released";

/** Shared IPv4 registry — same table as dior-billing (Prisma snake_case columns). */
@Entity("network_ip_allocations")
export default class NetworkIpAllocation {
  @PrimaryColumn({ type: "varchar", length: 191 })
  id!: string;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 45 })
  ip!: string;

  @Index()
  @Column({ type: "varchar", length: 50 })
  network!: string;

  @Column({ type: "varchar", length: 32 })
  owner!: NetworkIpOwner;

  @Index()
  @Column({ type: "varchar", length: 16 })
  status!: NetworkIpStatus;

  @Column({ type: "int", nullable: true })
  vmid!: number | null;

  @Index()
  @Column({ name: "vps_id", type: "varchar", length: 191, nullable: true })
  vpsId!: string | null;

  @Index()
  @Column({ name: "external_service_id", type: "varchar", length: 191, nullable: true })
  externalServiceId!: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  hostname!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 3 })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "datetime", precision: 3 })
  updatedAt!: Date;

  @Column({ name: "released_at", type: "datetime", precision: 3, nullable: true })
  releasedAt!: Date | null;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) this.id = randomUUID();
  }
}
