import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from "typeorm";
import { randomBytes } from "crypto";
import { Role } from "./User";

@Entity()
export default class TempLink {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: false, type: "varchar", unique: true })
  code!: string;

  @Column({ nullable: false, type: "varchar" })
  userPromoteTo!: Role;

  @Column({ nullable: true, type: "integer" })
  userId: number | null = null;

  /** If set, only this Telegram user may claim the promote link. */
  @Column({ nullable: true, type: "integer" })
  intendedTelegramId: number | null = null;

  @Column({ nullable: false, type: "datetime" })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;
}

export function createLink(role: Role, intendedTelegramId: number): TempLink {
  const code = randomBytes(24).toString("base64url");
  const newTempLink = new TempLink();

  newTempLink.code = code;
  newTempLink.userPromoteTo = role;
  newTempLink.intendedTelegramId = intendedTelegramId;
  // 6 Hours
  newTempLink.expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

  return newTempLink;
}
