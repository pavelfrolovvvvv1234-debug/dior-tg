import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** Reseller wallet movements exposed via Reseller API (debits/credits). */
@Entity("reseller_wallet_transactions")
export default class ResellerWalletTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: "varchar", length: 64 })
  resellerId!: string;

  /** Signed USD amount: negative = debit, positive = credit. */
  @Column({ type: "real" })
  amountUsd!: number;

  @Column({ type: "real" })
  balanceAfterUsd!: number;

  @Column({ type: "varchar", length: 32 })
  type!: "service_create" | "service_renew" | "manual_credit" | "manual_debit";

  @Column({ type: "integer", nullable: true })
  serviceId!: number | null;

  @Column({ type: "integer", nullable: true })
  vmid!: number | null;

  @Column({ type: "varchar", length: 256, nullable: true })
  detail!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
