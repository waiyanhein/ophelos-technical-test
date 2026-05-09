import bcrypt from 'bcrypt';
import { UTCDate } from '@date-fns/utc';
import jwt, { SignOptions } from 'jsonwebtoken';
import { loadConfig } from '../../../src/config/env';
import { AppDataSource } from '../../../src/data-source';
import { User } from '../../../src/entities/user.entity';
import {
  FinancialRecord,
  FinancialRecordType,
  FinancialRecordTypeCategory,
} from '../../../src/entities/financial-record.entity';

const PASSWORD_HASH_ROUNDS = 4;

interface CreateUserOverrides {
  name?: string;
  email?: string;
  password?: string;
}

export const createUser = async (overrides: CreateUserOverrides = {}): Promise<User> => {
  const repo = AppDataSource.getRepository(User);
  const user = repo.create({
    name: overrides.name ?? 'Ada Lovelace',
    email: overrides.email ?? 'ada@example.com',
    password:
      overrides.password ??
      (await bcrypt.hash('correct horse battery staple', PASSWORD_HASH_ROUNDS)),
  });
  return repo.save(user);
};

export const tokenForUser = (user: Pick<User, 'id' | 'email'>): string => {
  const { jwtSecret } = loadConfig();
  const options: SignOptions = { expiresIn: '1h' };
  return jwt.sign({ userId: user.id, email: user.email }, jwtSecret, options);
};

export interface RecordSeed {
  amount: number;
  type: FinancialRecordType;
  typeCategory?: FinancialRecordTypeCategory | null;
  description?: string;
  transactionDate: Date;
}

export const seedRecords = async (userId: string, seeds: RecordSeed[]): Promise<void> => {
  const repo = AppDataSource.getRepository(FinancialRecord);
  await repo.save(
    seeds.map((seed) =>
      repo.create({
        userId,
        amount: seed.amount.toFixed(2),
        type: seed.type,
        typeCategory: seed.typeCategory ?? null,
        description: seed.description ?? `${seed.type} record`,
        transactionDate: seed.transactionDate,
      }),
    ),
  );
};

export const utc = (year: number, monthIndex: number, day: number, hour = 12): Date =>
  new UTCDate(year, monthIndex, day, hour, 0, 0, 0);

export const monthQuery = (monthIndex: number): string => String(monthIndex + 1).padStart(2, '0');
