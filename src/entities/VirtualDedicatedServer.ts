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

  @Column()
  vdsId!: number;

  @Column({ default: "root" })
  login!: string;

  @Column()
  password!: string;

  @Column({ nullable: true })
  ipv4Addr!: string;

  @Column()
  cpuCount!: number;

  // Mbits/ps
  @Column()
  networkSpeed!: number;

  @Column()
  isBulletproof!: boolean;

  // Gb
  @Column()
  ramSize!: number;

  @Column()
  diskSize!: number;

  @Column()
  lastOsId!: number;

  @Column()
  rateName!: string;

  @Column({ nullable: false })
  expireAt!: Date;

  @Column({ nullable: false })
  targetUserId!: number;

  @Column({ nullable: false })
  renewalPrice!: number;

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
