import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export enum DomainRequestStatus {
  InProgress = "in_progress",
  Failed = "failed",
  Completed = "completed",
}

@Entity()
export default class DomainRequest {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  domainName!: string;

  @Column()
  zone!: string;

  @Column({
    default: DomainRequestStatus.InProgress,
    type: "varchar",
    nullable: false,
  })
  status!: DomainRequestStatus;

  @Column({ nullable: false })
  target_user_id!: number;

  @Column({ nullable: true })
  nameservers!: string;

  @Column({ nullable: true })
  mod_id!: number;

  @Column({ nullable: false })
  price!: number;

  @Column({ nullable: true })
  expire_at!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;

  @Column({ nullable: true })
  payday_at!: Date;
}

export function createDomainRequest(
  domainName: string,
  zone: string,
  target_user_id: number,
  mod_id: number
): DomainRequest {
  const newDomainRequest = new DomainRequest();

  newDomainRequest.domainName = domainName;
  newDomainRequest.zone = zone;
  newDomainRequest.target_user_id = target_user_id;
  newDomainRequest.mod_id = mod_id;

  return newDomainRequest;
}
