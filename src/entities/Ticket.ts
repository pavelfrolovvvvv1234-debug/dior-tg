import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

enum TicketStatus {
  Open = "open",
  Closed = "closed",
}

@Entity()
export default class Ticket {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ nullable: false })
  title!: string;

  @Column({ default: TicketStatus.Open, type: "varchar", nullable: false })
  status!: TicketStatus;

  @Column({ nullable: false })
  mod_id!: number;

  @Column({ nullable: false })
  target_user_id!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;
}
