import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { UTCDate } from '@date-fns/utc';
import { setDate, setHours, startOfMonth, subMonths } from 'date-fns';
import { AppDataSource } from '../data-source';
import { User } from '../entities/user.entity';
import {
  FinancialRecord,
  FinancialRecordType,
  FinancialRecordTypeCategory,
} from '../entities/financial-record.entity';

const SEED_USER = {
  name: 'Wai Hein',
  email: 'waiyanhein@test.com',
  password: 'Test123!',
};

const BCRYPT_ROUNDS = 10;

interface SeedRecord {
  amount: number;
  type: FinancialRecordType;
  typeCategory: FinancialRecordTypeCategory | null;
  description: string;
  monthsAgo: number;
  day: number;
}

const buildSeedRecords = (): SeedRecord[] => {
  const records: SeedRecord[] = [];

  // 6 months of data ending at the current month — values trend toward
  // healthier spending so the progress widget tells a story in dev.
  const monthly: Array<{ income: number; outgoing: number }> = [
    { income: 3000, outgoing: 2700 },
    { income: 3000, outgoing: 2500 },
    { income: 3000, outgoing: 2300 },
    { income: 3000, outgoing: 2100 },
    { income: 3000, outgoing: 1800 },
    { income: 3000, outgoing: 1500 },
  ];

  monthly.forEach((row, index) => {
    const monthsAgo = monthly.length - 1 - index;
    records.push({
      amount: row.income,
      type: 'income',
      typeCategory: null,
      description: 'Salary',
      monthsAgo,
      day: 1,
    });
    records.push({
      amount: row.outgoing * 0.5,
      type: 'outgoing',
      typeCategory: 'essential',
      description: 'Rent and bills',
      monthsAgo,
      day: 5,
    });
    records.push({
      amount: row.outgoing * 0.3,
      type: 'outgoing',
      typeCategory: 'debt-repayment',
      description: 'Loan repayment',
      monthsAgo,
      day: 10,
    });
    records.push({
      amount: row.outgoing * 0.2,
      type: 'outgoing',
      typeCategory: 'discretionary',
      description: 'Subscriptions and dining',
      monthsAgo,
      day: 20,
    });
  });

  return records;
};

const seedFinancialRecords = async (userId: string): Promise<void> => {
  const repo = AppDataSource.getRepository(FinancialRecord);
  const existing = await repo.count({ where: { userId } });
  if (existing > 0) {
    console.log(`Financial records for user already exist (${existing}) — skipping.`);
    return;
  }

  const currentMonthStart = startOfMonth(new UTCDate());
  const seeds = buildSeedRecords();
  const entities = seeds.map((seed) => {
    const monthStart = subMonths(currentMonthStart, seed.monthsAgo);
    const transactionDate = setHours(setDate(monthStart, seed.day), 12);
    return repo.create({
      userId,
      amount: seed.amount.toFixed(2),
      type: seed.type,
      typeCategory: seed.typeCategory,
      description: seed.description,
      transactionDate,
    });
  });

  await repo.save(entities);
  console.log(`Inserted ${entities.length} financial records.`);
};

const seed = async (): Promise<void> => {
  await AppDataSource.initialize();

  try {
    const repo = AppDataSource.getRepository(User);
    let user = await repo.findOne({ where: { email: SEED_USER.email } });

    if (user) {
      console.log(`User "${SEED_USER.email}" already exists — skipping user insert.`);
    } else {
      const passwordHash = await bcrypt.hash(SEED_USER.password, BCRYPT_ROUNDS);
      user = await repo.save(
        repo.create({
          name: SEED_USER.name,
          email: SEED_USER.email,
          password: passwordHash,
        }),
      );
      console.log(`Created user "${SEED_USER.email}".`);
    }

    await seedFinancialRecords(user.id);
  } finally {
    await AppDataSource.destroy();
  }
};

seed().catch((error: unknown) => {
  console.error('Seeding failed', error);
  process.exit(1);
});
