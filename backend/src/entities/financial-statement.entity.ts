import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Dashboard } from '../services/financial.service';

@Entity({ name: 'financial_statements' })
export class FinancialStatement {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Index('financial_statements_user_id_idx')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'jsonb' })
  data!: Dashboard; // @todo - Dashboard should be part of the data/ entity layer rather than the service layer. Move it into the right place.

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
