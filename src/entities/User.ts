import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  CreateDateColumn,
} from "typeorm";

export enum Role {
  User = "user",
  Moderator = "mod",
  Admin = "admin",
}

@Entity()
export default class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: false })
  telegramId!: number;

  @Column({ default: 0.0, type: "real", nullable: false })
  balance!: number;

  @Column({ default: 0, nullable: false })
  isBanned!: boolean;

  @Column({ default: Role.User, type: "varchar", nullable: false })
  role!: Role;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;
}
