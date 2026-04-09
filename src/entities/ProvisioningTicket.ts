import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum ProvisioningTicketStatus {
  NEW = "new",
  PENDING_REVIEW = "pending_review",
  AWAITING_PAYMENT = "awaiting_payment",
  PAID = "paid",
  AWAITING_STOCK = "awaiting_stock",
  IN_PROVISIONING = "in_provisioning",
  AWAITING_FINAL_CHECK = "awaiting_final_check",
  COMPLETED = "completed",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

@Entity("provisioning_tickets")
@Index(["status", "createdAt"])
@Index(["assigneeUserId", "status"])
@Index(["orderId"], { unique: true })
export default class ProvisioningTicket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer" })
  orderId!: number;

  @Column({ type: "varchar", unique: true })
  ticketNumber!: string;

  @Column({ type: "varchar", default: ProvisioningTicketStatus.NEW })
  status!: ProvisioningTicketStatus;

  @Column({ type: "integer", nullable: true })
  assigneeUserId!: number | null;

  @Column({ type: "integer", nullable: true })
  linkedLegacyTicketId!: number | null;

  @Column({ type: "datetime", nullable: true })
  completedAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
