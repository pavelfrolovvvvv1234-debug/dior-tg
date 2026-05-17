/**
 * Per-user engagement score and segment tags for notification targeting.
 *
 * @module entities/notifications/UserEngagementProfile
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("user_engagement_profiles")
export default class UserEngagementProfile {
  @PrimaryColumn({ type: "integer" })
  userId!: number;

  @Column({ type: "real", default: 0, nullable: false })
  engagementScore!: number;

  @Column({ type: "real", default: 0, nullable: false })
  totalSpend!: number;

  @Column({ type: "int", default: 0, nullable: false })
  activeServiceCount!: number;

  @Column({ type: "text", nullable: true })
  segmentTagsJson!: string | null;

  @Column({ type: "boolean", default: false, nullable: false })
  isVip!: boolean;

  @Column({ type: "datetime", nullable: true })
  lastActiveAt!: Date | null;

  @Column({ type: "datetime", nullable: true })
  lastPurchaseAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
