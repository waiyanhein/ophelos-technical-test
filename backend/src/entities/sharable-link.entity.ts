import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FinancialStatement } from './financial-statement.entity';

@Entity({ name: 'sharable_links' })
export class SharableLink {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number;

  @Index('sharable_links_financial_statement_id_idx')
  @Column({ name: 'financial_statement_id', type: 'integer' })
  financialStatementId!: number;

  @ManyToOne(() => FinancialStatement, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'financial_statement_id' })
  financialStatement!: FinancialStatement;

  @Column({ type: 'varchar', length: 255, unique: true })
  token!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
