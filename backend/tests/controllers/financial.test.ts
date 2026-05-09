import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config/env';
import { AppDataSource } from '../../src/data-source';
import { User } from '../../src/entities/user.entity';
import {
  FinancialRecord,
  FinancialRecordType,
  FinancialRecordTypeCategory,
} from '../../src/entities/financial-record.entity';

const PASSWORD_HASH_ROUNDS = 4;

interface CreateUserOverrides {
  name?: string;
  email?: string;
  password?: string;
}

const createUser = async (overrides: CreateUserOverrides = {}): Promise<User> => {
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

const tokenForUser = (user: Pick<User, 'id' | 'email'>): string => {
  const { jwtSecret } = loadConfig();
  const options: SignOptions = { expiresIn: '1h' };
  return jwt.sign({ userId: user.id, email: user.email }, jwtSecret, options);
};

interface RecordSeed {
  amount: number;
  type: FinancialRecordType;
  typeCategory?: FinancialRecordTypeCategory | null;
  description?: string;
  transactionDate: Date;
}

const seedRecords = async (userId: string, seeds: RecordSeed[]): Promise<void> => {
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

const utc = (year: number, monthIndex: number, day: number, hour = 12): Date =>
  new Date(Date.UTC(year, monthIndex, day, hour, 0, 0, 0));

describe('GET /financial/dashboard (integration)', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    await AppDataSource.query(
      'TRUNCATE TABLE "financial_records", "users" RESTART IDENTITY CASCADE',
    );
  });

  describe('authentication', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      const response = await request(createApp()).get('/financial/dashboard');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Missing or malformed authorization header',
      });
    });

    it('returns 401 when the Authorization header is malformed', async () => {
      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', 'NotBearer abc');
      expect(response.status).toBe(401);
    });

    it('returns 401 when the JWT signature is invalid', async () => {
      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });

    it('returns 401 when the JWT has expired', async () => {
      const user = await createUser();
      const { jwtSecret } = loadConfig();
      const expired = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, {
        expiresIn: '-1s',
      });
      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', `Bearer ${expired}`);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token has expired' });
    });
  });

  describe('query parameter validation', () => {
    it('rejects a non-2-digit month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=3')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ValidationError');
    });

    it('rejects an out-of-range month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=13')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it('rejects a non-numeric month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=ab')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('response shape and business logic', () => {
    it('wraps the over-time progress array in an overTimeProgress field', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Object.keys(response.body)).toEqual(['overTimeProgress']);
      expect(Array.isArray(response.body.overTimeProgress)).toBe(true);
    });

    it('returns the last 6 months ending at the supplied month, most recent first', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      // March 2026 — multiple records spread across days.
      // Disposable incomes across the window: -200, 600, 1300, 200, 1000, 2000.
      // Min = -200 (Oct), Max = 2000 (Mar), range = 2200.
      await seedRecords(user.id, [
        // March (month=03): income 3000, outgoings 1000 → disposable 2000 (window max → 100)
        {
          amount: 1500,
          type: 'income',
          description: 'Salary first half',
          transactionDate: utc(currentYear, 2, 1),
        },
        {
          amount: 1500,
          type: 'income',
          description: 'Salary second half',
          transactionDate: utc(currentYear, 2, 15),
        },
        {
          amount: 600,
          type: 'outgoing',
          typeCategory: 'essential',
          transactionDate: utc(currentYear, 2, 5),
        },
        {
          amount: 400,
          type: 'outgoing',
          typeCategory: 'discretionary',
          transactionDate: utc(currentYear, 2, 28),
        },

        // February: income 2000, outgoings 1000 → disposable 1000 → 1200/2200 ≈ 55
        {
          amount: 2000,
          type: 'income',
          transactionDate: utc(currentYear, 1, 10),
        },
        {
          amount: 1000,
          type: 'outgoing',
          typeCategory: 'debt-repayment',
          transactionDate: utc(currentYear, 1, 22),
        },

        // January: income 2000, outgoings 1800 → disposable 200 → 400/2200 ≈ 18
        {
          amount: 2000,
          type: 'income',
          transactionDate: utc(currentYear, 0, 3),
        },
        {
          amount: 1800,
          type: 'outgoing',
          transactionDate: utc(currentYear, 0, 28),
        },

        // December (previous year): income 2000, outgoings 700 → disposable 1300 → 1500/2200 ≈ 68
        {
          amount: 2000,
          type: 'income',
          transactionDate: utc(currentYear - 1, 11, 15),
        },
        {
          amount: 700,
          type: 'outgoing',
          transactionDate: utc(currentYear - 1, 11, 30),
        },

        // November: income 2000, outgoings 1400 → disposable 600 → 800/2200 ≈ 36
        {
          amount: 2000,
          type: 'income',
          transactionDate: utc(currentYear - 1, 10, 5),
        },
        {
          amount: 1400,
          type: 'outgoing',
          transactionDate: utc(currentYear - 1, 10, 20),
        },

        // October: zero income, some outgoings → disposable -200 (window min → 0)
        {
          amount: 200,
          type: 'outgoing',
          transactionDate: utc(currentYear - 1, 9, 12),
        },

        // Out of window: September previous year — should be ignored.
        {
          amount: 9999,
          type: 'income',
          transactionDate: utc(currentYear - 1, 8, 1),
        },
        // Out of window: April current year — should be ignored.
        {
          amount: 5000,
          type: 'income',
          transactionDate: utc(currentYear, 3, 1),
        },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard?month=03')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.overTimeProgress).toEqual([
        {
          period: `Mar ${currentYear}`,
          progress: 100,
          disposable_income: 2000,
          is_now: false,
        },
        {
          period: `Feb ${currentYear}`,
          progress: 55,
          disposable_income: 1000,
          is_now: false,
        },
        {
          period: `Jan ${currentYear}`,
          progress: 18,
          disposable_income: 200,
          is_now: false,
        },
        {
          period: `Dec ${currentYear - 1}`,
          progress: 68,
          disposable_income: 1300,
          is_now: false,
        },
        {
          period: `Nov ${currentYear - 1}`,
          progress: 36,
          disposable_income: 600,
          is_now: false,
        },
        {
          period: `Oct ${currentYear - 1}`,
          progress: 0,
          disposable_income: -200,
          is_now: false,
        },
      ]);
    });

    it('defaults to the current month and year when no month query parameter is provided', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonthIndex = now.getUTCMonth();

      await seedRecords(user.id, [
        {
          amount: 5000,
          type: 'income',
          transactionDate: utc(currentYear, currentMonthIndex, 5),
        },
        {
          amount: 1000,
          type: 'outgoing',
          transactionDate: utc(currentYear, currentMonthIndex, 20),
        },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.overTimeProgress).toHaveLength(6);

      const mostRecent = response.body.overTimeProgress[0];
      const monthLabels = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      expect(mostRecent).toEqual({
        period: `${monthLabels[currentMonthIndex]} ${currentYear}`,
        // Only the current month has activity (disposable 4000); the other five
        // buckets are 0. Min=0, Max=4000 → current month is the window peak.
        progress: 100,
        disposable_income: 4000,
        is_now: true,
      });

      const earlierFlags: boolean[] = response.body.overTimeProgress
        .slice(1)
        .map((point: { is_now: boolean }) => point.is_now);
      expect(earlierFlags.every((flag) => flag === false)).toBe(true);
    });
  });

  describe('window-relative progress formula', () => {
    it('scales each month linearly between the window min and max', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      // Disposable incomes (Jan→Jun): 200, 600, 1000, 1500, 800, 400.
      // Up Jan→Apr (peak), down Apr→Jun. Min=200, Max=1500, range=1300.
      await seedRecords(user.id, [
        { amount: 200, type: 'income', transactionDate: utc(currentYear, 0, 5) },
        { amount: 600, type: 'income', transactionDate: utc(currentYear, 1, 5) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 2, 5) },
        { amount: 1500, type: 'income', transactionDate: utc(currentYear, 3, 5) },
        { amount: 800, type: 'income', transactionDate: utc(currentYear, 4, 5) },
        { amount: 400, type: 'income', transactionDate: utc(currentYear, 5, 5) },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard?month=06')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const progresses = response.body.overTimeProgress.map(
        (p: { progress: number }) => p.progress,
      );
      // Returned newest → oldest: Jun, May, Apr (peak), Mar, Feb, Jan (min).
      expect(progresses).toEqual([15, 46, 100, 62, 31, 0]);
    });

    it('returns 50 for every period when all months have equal disposable income', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      // Six months, identical income/outgoing → every disposable income is 500.
      const seeds: RecordSeed[] = [];
      for (let monthIndex = 0; monthIndex < 6; monthIndex += 1) {
        seeds.push(
          { amount: 1500, type: 'income', transactionDate: utc(currentYear, monthIndex, 5) },
          { amount: 1000, type: 'outgoing', transactionDate: utc(currentYear, monthIndex, 20) },
        );
      }
      await seedRecords(user.id, seeds);

      const response = await request(createApp())
        .get('/financial/dashboard?month=06')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      for (const point of response.body.overTimeProgress) {
        expect(point.progress).toBe(50);
        expect(point.disposable_income).toBe(500);
      }
    });
  });

  describe('edge cases', () => {
    it('returns zeroed buckets for months with no records', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=06')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.overTimeProgress).toHaveLength(6);
      // Every month has the same disposable income (0), which the formula
      // treats as a stable position → 50, not 0.
      for (const point of response.body.overTimeProgress) {
        expect(point.progress).toBe(50);
        expect(point.disposable_income).toBe(0);
      }
    });

    it('returns progress 0 when income is zero but outgoings exist', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      await seedRecords(user.id, [
        {
          amount: 250,
          type: 'outgoing',
          transactionDate: utc(currentYear, 5, 5),
        },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard?month=06')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const target = response.body.overTimeProgress[0];
      expect(target.progress).toBe(0);
      expect(target.disposable_income).toBe(-250);
    });

    it('isolates results to the authenticated user', async () => {
      const user = await createUser();
      const otherUser = await createUser({ email: 'other@example.com' });
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      await seedRecords(otherUser.id, [
        {
          amount: 9999,
          type: 'income',
          transactionDate: utc(currentYear, 5, 1),
        },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard?month=06')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      for (const point of response.body.overTimeProgress) {
        expect(point.progress).toBe(50);
        expect(point.disposable_income).toBe(0);
      }
    });

    it('returns the periods sorted from most recent to oldest', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      // Seed in arbitrary (non-chronological) order to make sure the API
      // sort is deterministic and not dependent on insert order.
      await seedRecords(user.id, [
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 5, 5) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 0, 5) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 3, 5) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 1, 5) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 4, 5) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 2, 5) },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard?month=06')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const periods: string[] = response.body.overTimeProgress.map(
        (p: { period: string }) => p.period,
      );
      expect(periods).toEqual([
        `Jun ${currentYear}`,
        `May ${currentYear}`,
        `Apr ${currentYear}`,
        `Mar ${currentYear}`,
        `Feb ${currentYear}`,
        `Jan ${currentYear}`,
      ]);

      const monthOrder = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const toComparable = (period: string): number => {
        const [month, year] = period.split(' ');
        return Number(year) * 12 + monthOrder.indexOf(month);
      };
      const ordinals = periods.map(toComparable);
      const sortedDescending = [...ordinals].sort((a, b) => b - a);
      expect(ordinals).toEqual(sortedDescending);
    });

    it('handles a window that crosses the year boundary', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = new Date().getUTCFullYear();

      // Asking for month=02 with 6 months lookback → Sep prev year through Feb current year.
      await seedRecords(user.id, [
        { amount: 1000, type: 'income', transactionDate: utc(currentYear - 1, 8, 15) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 1, 15) },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard?month=02')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.overTimeProgress.map((p: { period: string }) => p.period)).toEqual([
        `Feb ${currentYear}`,
        `Jan ${currentYear}`,
        `Dec ${currentYear - 1}`,
        `Nov ${currentYear - 1}`,
        `Oct ${currentYear - 1}`,
        `Sep ${currentYear - 1}`,
      ]);
      // Feb (most recent) and Sep (oldest) are the two months with seeded income.
      expect(response.body.overTimeProgress[0].disposable_income).toBe(1000);
      expect(response.body.overTimeProgress[5].disposable_income).toBe(1000);
    });
  });
});
