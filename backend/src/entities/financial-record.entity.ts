import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type FinancialRecordType = 'income' | 'outgoing';

export type FinancialRecordTypeCategory = 'debt-repayment' | 'discretionary' | 'essential';

export const FINANCIAL_RECORD_TYPES: readonly FinancialRecordType[] = ['income', 'outgoing'];

export const FINANCIAL_RECORD_TYPE_CATEGORIES: readonly FinancialRecordTypeCategory[] = [
  'debt-repayment',
  'discretionary',
  'essential',
];

@Entity({ name: 'financial_records' })
export class FinancialRecord {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string;

  @Column({ type: 'enum', enum: FINANCIAL_RECORD_TYPES })
  type!: FinancialRecordType;

  @Column({
    name: 'type_category',
    type: 'enum',
    enum: FINANCIAL_RECORD_TYPE_CATEGORIES,
    nullable: true,
  })
  typeCategory!: FinancialRecordTypeCategory | null;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Index('financial_records_transaction_date_idx')
  @Column({ name: 'transaction_date', type: 'timestamptz' })
  transactionDate!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Index('financial_records_user_id_idx')
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
