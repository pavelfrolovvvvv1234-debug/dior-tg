import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NetworkIpOwner = "telegram_bot" | "billing" | "manual";
export type NetworkIpStatus = "reserved" | "active" | "released";

/** Shared IPv4 registry — bot and web billing must use the same table / database. */
@Entity("network_ip_allocations")
export default class NetworkIpAllocation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: "varchar", length: 15 })
  ip!: string;

  @Index()
  @Column({ type: "varchar", length: 43 })
  network!: string;

  @Column({ type: "varchar", length: 32 })
  owner!: NetworkIpOwner;

  @Column({ type: "varchar", length: 16, default: "reserved" })
  status!: NetworkIpStatus;

  @Column({ type: "integer", nullable: true })
  vmid!: number | null;

  @Column({ type: "varchar", length: 64, nullable: true })
  externalServiceId!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: "datetime", nullable: true })
  releasedAt!: Date | null;
}
