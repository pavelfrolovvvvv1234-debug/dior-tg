import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";

@Entity()
export default class DomainService {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  domain!: string;

  // Zone list
  // com
  // org
  // net
  // biz
  // club
  // pro
  // uk
  // cc
  // io
  // us
  // at
  // ca
  // guru
  // link
  // info
  @Column()
  zone!: string;

  @Column({ nullable: false })
  expire_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @Column({ nullable: false })
  payday_at!: Date;
}
