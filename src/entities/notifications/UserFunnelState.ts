/**
 * Tracks in-progress orders for abandoned-deploy recovery.
 *
 * @module entities/notifications/UserFunnelState
 */

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("user_funnel_states")
@Index(["userId", "funnelKey"], { unique: true })
export default class UserFunnelState {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: false })
  userId!: number;

  @Column({ type: "varchar", length: 32, nullable: false })
  funnelKey!: string;

  @Column({ type: "text", nullable: true })
  payloadJson!: string | null;

  @Column({ type: "boolean", default: false, nullable: false })
  completed!: boolean;

  @Column({ type: "boolean", default: false, nullable: false })
  recoveryStopped!: boolean;

  @UpdateDateColumn()
  lastStepAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
