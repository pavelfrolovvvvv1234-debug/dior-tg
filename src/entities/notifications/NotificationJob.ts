/**
 * Queued notification job (async delivery orchestration).
 *
 * @module entities/notifications/NotificationJob
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type NotificationJobStatus =
  | "pending"
  | "processing"
  | "sent"
  | "failed"
  | "cancelled"
  | "dead";

export type NotificationChannel = "telegram" | "email" | "panel";

@Entity("notification_jobs")
@Index(["status", "scheduledAt"])
@Index(["userId", "campaignKey"])
@Index(["userId", "dedupeKey"])
export default class NotificationJob {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: false })
  userId!: number;

  @Column({ type: "varchar", length: 64, nullable: false })
  campaignKey!: string;

  @Column({ type: "varchar", length: 64, nullable: false })
  templateKey!: string;

  @Column({ type: "varchar", length: 8, default: "ru", nullable: false })
  locale!: "ru" | "en";

  @Column({ type: "text", nullable: true })
  payloadJson!: string | null;

  @Column({ type: "varchar", length: 16, default: "telegram", nullable: false })
  channel!: NotificationChannel;

  @Column({ type: "varchar", length: 16, default: "pending", nullable: false })
  status!: NotificationJobStatus;

  @Column({ type: "datetime", nullable: false })
  scheduledAt!: Date;

  @Column({ type: "int", default: 0, nullable: false })
  attempts!: number;

  @Column({ type: "int", default: 5, nullable: false })
  maxAttempts!: number;

  @Column({ type: "varchar", length: 512, nullable: true })
  lastError!: string | null;

  @Column({ type: "int", default: 0, nullable: false })
  priority!: number;

  @Column({ type: "varchar", length: 32, nullable: true })
  variantKey!: string | null;

  /** Idempotency key (per user) — prevents duplicate campaigns across pending/sent window. */
  @Column({ type: "varchar", length: 128, nullable: true })
  dedupeKey!: string | null;

  @Column({ type: "datetime", nullable: true })
  sentAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  cancelledAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
