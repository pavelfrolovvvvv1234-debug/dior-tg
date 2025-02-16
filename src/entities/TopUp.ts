import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

enum TopUpStatus {
  Created = "created",
  Completed = "completed",
}

@Entity()
export default class TopUp {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ default: TopUpStatus.Created, type: "varchar", nullable: false })
  status!: TopUpStatus;

  @Column({ nullable: false, type: "varchar" })
  url!: string;

  @Column({ nullable: false })
  amount!: number;

  @Column({ nullable: true, type: "varchar" })
  orderId!: string;

  @Column({ nullable: false })
  target_user_id!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;
}
