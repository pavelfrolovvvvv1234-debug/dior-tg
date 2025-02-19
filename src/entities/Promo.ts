import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity()
export default class Promo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  maxUses!: number;

  @Column({ default: 0 })
  uses!: number;

  @Column({
    type: "simple-json",
    default: "[]",
  })
  users!: number[];

  @Column()
  code!: string;

  @Column()
  sum!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  lastUpdateAt!: Date;
}
