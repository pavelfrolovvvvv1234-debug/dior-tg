import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

enum VdsStatus {
  InProgress = "in_progress",
  Created = "created",
}

@Entity("vdslist")
export default class VirtualDedicatedServer {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", nullable: false })
  vdsId!: number;

  @Column({ default: "root", type: "varchar", nullable: false })
  login!: string;

  @Column({ type: "varchar", nullable: false })
  password!: string;

  @Column({ nullable: true, type: "varchar" })
  ipv4Addr!: string;

  @Column({ type: "integer", nullable: false })
  cpuCount!: number;

  // Mbits/ps
  @Column({ type: "integer", nullable: false })
  networkSpeed!: number;

  @Column({ type: "boolean", nullable: false })
  isBulletproof!: boolean;

  @Column({ nullable: true, type: "datetime" })
  payDayAt!: Date | null;

  // Gb
  @Column({ type: "integer", nullable: false })
  ramSize!: number;

  @Column({ type: "integer", nullable: false })
  diskSize!: number;

  @Column({ type: "integer", nullable: false })
  lastOsId!: number;

  @Column({ type: "varchar", nullable: false })
  rateName!: string;

  @Column({ nullable: false, type: "datetime" })
  expireAt!: Date;

  @Column({ nullable: false, type: "integer" })
  targetUserId!: number;

  @Column({ nullable: false, type: "real" })
  renewalPrice!: number;

  @Column({ nullable: true, type: "varchar" })
  displayName!: string | null;

  /** Set when VPS was purchased as part of an infrastructure bundle (e.g. "1m", "3m"). */
  @Column({ nullable: true, type: "varchar" })
  bundleType!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;
}

export function generatePassword(length: number): string {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
}

export function generateRandomName(length: number): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const words = [
    "Alpha",
    "Beta",
    "Gamma",
    "Delta",
    "Epsilon",
    "Zeta",
    "Eta",
    "Theta",
    "Iota",
    "Kappa",
  ];
  let name = words[Math.floor(Math.random() * words.length)];
  for (let i = name.length; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    name += charset[randomIndex];
  }
  return name;
}
