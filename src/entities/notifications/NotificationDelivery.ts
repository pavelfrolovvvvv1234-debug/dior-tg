/**
 * Delivery log + engagement metrics per send.
 *
 * @module entities/notifications/NotificationDelivery
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export type DeliveryStatus = "sent" | "failed" | "skipped";

@Entity("notification_deliveries")
@Index(["userId", "campaignKey"])
@Index(["sentAt"])
export default class NotificationDelivery {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: true })
  jobId!: number | null;

  @Column({ type: "integer", nullable: false })
  userId!: number;

  @Column({ type: "varchar", length: 64, nullable: false })
  campaignKey!: string;

  @Column({ type: "varchar", length: 64, nullable: false })
  templateKey!: string;

  @Column({ type: "varchar", length: 16, default: "telegram", nullable: false })
  channel!: string;

  @Column({ type: "varchar", length: 16, nullable: false })
  status!: DeliveryStatus;

  @Column({ type: "varchar", length: 32, nullable: true })
  variantKey!: string | null;

  @Column({ type: "varchar", length: 128, nullable: true })
  skipReason!: string | null;

  @Column({ type: "varchar", length: 512, nullable: true })
  error!: string | null;

  @Column({ type: "integer", nullable: true })
  telegramMessageId!: number | null;

  @Column({ type: "datetime", nullable: true })
  clickedAt!: Date | null;

  @CreateDateColumn()
  sentAt!: Date;
}
