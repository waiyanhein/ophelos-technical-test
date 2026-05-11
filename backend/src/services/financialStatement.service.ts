import { EntityManager } from 'typeorm';
import { FinancialStatement as FinancialStatementEntity } from '../entities/financial-statement.entity';
import { User } from '../entities/user.entity';
import { Dashboard, DashboardOptions, getDashboard } from './financial.service';
import { AppDataSource } from '../data-source';

export type FinancialStatement = {
  id: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
  data: Dashboard;
  createdAt: Date;
};

const financialStatementRepository = AppDataSource.getRepository(FinancialStatementEntity);

export const findStatementById = async (id: number): Promise<FinancialStatement | null> => {
  // join with user
  const statement = await financialStatementRepository.findOne({
    where: {
      id,
    },
    relations: ['user'],
  });
  if (!statement) {
    return null;
  }

  return {
    id: statement.id,
    user: {
      id: statement.user.id,
      name: statement.user.name,
      email: statement.user.email,
    },
    data: statement.data,
    createdAt: statement.createdAt,
  };
};

export const generateStatement = async (
  manager: EntityManager,
  options: DashboardOptions,
): Promise<FinancialStatement> => {
  const user = await manager.getRepository(User).findOne({
    where: {
      id: options.userId,
    },
  });
  if (!user) {
    throw new Error('User not found');
  }
  const dashboard = await getDashboard(options);

  const savedStatement = await manager.getRepository(FinancialStatementEntity).save({
    userId: user.id,
    data: dashboard,
    createdAt: new Date(),
  });

  return {
    id: savedStatement.id,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    data: savedStatement.data,
    createdAt: savedStatement.createdAt,
  };
};
