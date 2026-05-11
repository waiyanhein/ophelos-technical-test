jest.mock('../../../../src/services/recommendations.service', () => ({
  getRecommendations: jest.fn().mockResolvedValue([]),
}));

import { UTCDate } from '@date-fns/utc';
import { getMonth, getYear } from 'date-fns';
import request from 'supertest';
import { createApp } from '../../../../src/app';
import { AppDataSource } from '../../../../src/data-source';
import {
  FinancialRecord,
  FinancialRecordTypeCategory,
} from '../../../../src/entities/financial-record.entity';
import { withDatabase } from '../../../utilities';
import { createUser, monthQuery, seedRecords, tokenForUser, utc } from '../helpers';

describe('GET /financial/dashboard — yourMoneyThisMonth (integration)', () => {
  withDatabase();

  describe('grouping and field accuracy', () => {
    it('groups income records under income and outgoing records by type_category', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 2800,
          type: 'income',
          description: 'Salary',
          transactionDate: utc(currentYear, 5, 1),
        },
        {
          amount: 300,
          type: 'income',
          description: 'Other',
          transactionDate: utc(currentYear, 5, 5),
        },
        {
          amount: 500,
          type: 'outgoing',
          typeCategory: 'essential',
          description: 'Mortgage',
          transactionDate: utc(currentYear, 5, 2),
        },
        {
          amount: 100,
          type: 'outgoing',
          typeCategory: 'essential',
          description: 'Utilities',
          transactionDate: utc(currentYear, 5, 3),
        },
        {
          amount: 1000,
          type: 'outgoing',
          typeCategory: 'debt-repayment',
          description: 'Loan repayment',
          transactionDate: utc(currentYear, 5, 4),
        },
        {
          amount: 15,
          type: 'outgoing',
          typeCategory: 'discretionary',
          description: 'Netflix',
          transactionDate: utc(currentYear, 5, 6),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth).toEqual({
        income: {
          total: 3100,
          sections: [
            {
              sectionKey: 'income',
              sectionLabel: 'Income',
              subtotal: 3100,
              items: [
                { description: 'Salary', amount: 2800 },
                { description: 'Other', amount: 300 },
              ],
            },
          ],
        },
        outgoing: {
          total: 1615,
          sections: [
            {
              sectionKey: 'debtRepayment',
              sectionLabel: 'Debt Repayment',
              subtotal: 1000,
              items: [{ description: 'Loan repayment', amount: 1000 }],
            },
            {
              sectionKey: 'discretionary',
              sectionLabel: 'Discretionary',
              subtotal: 15,
              items: [{ description: 'Netflix', amount: 15 }],
            },
            {
              sectionKey: 'essential',
              sectionLabel: 'Essential',
              subtotal: 600,
              items: [
                { description: 'Mortgage', amount: 500 },
                { description: 'Utilities', amount: 100 },
              ],
            },
          ],
        },
      });
    });

    it('aggregates multiple records sharing the same description into a single line', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 1500,
          type: 'income',
          description: 'Salary',
          transactionDate: utc(currentYear, 5, 1),
        },
        {
          amount: 1500,
          type: 'income',
          description: 'Salary',
          transactionDate: utc(currentYear, 5, 15),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.income.sections[0].items).toEqual([
        { description: 'Salary', amount: 3000 },
      ]);
      expect(response.body.yourMoneyThisMonth.income.total).toBe(3000);
      expect(response.body.yourMoneyThisMonth.income.sections[0].subtotal).toBe(3000);
    });

    it('produces section subtotals that match the sum of their items, and group totals that match the sum of their subtotals', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 100,
          type: 'outgoing',
          typeCategory: 'essential',
          transactionDate: utc(currentYear, 5, 1),
        },
        {
          amount: 200,
          type: 'outgoing',
          typeCategory: 'essential',
          transactionDate: utc(currentYear, 5, 2),
        },
        {
          amount: 50,
          type: 'outgoing',
          typeCategory: 'discretionary',
          transactionDate: utc(currentYear, 5, 3),
        },
        {
          amount: 75,
          type: 'outgoing',
          typeCategory: 'discretionary',
          transactionDate: utc(currentYear, 5, 4),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const outgoing = response.body.yourMoneyThisMonth.outgoing;
      for (const section of outgoing.sections) {
        const itemSum = section.items.reduce(
          (acc: number, item: { amount: number }) => acc + item.amount,
          0,
        );
        expect(section.subtotal).toBe(itemSum);
      }
      const subtotalSum = outgoing.sections.reduce(
        (acc: number, section: { subtotal: number }) => acc + section.subtotal,
        0,
      );
      expect(outgoing.total).toBe(subtotalSum);
      expect(outgoing.total).toBe(425);
    });
  });

  describe('user isolation', () => {
    it('returns only the authenticated user’s records', async () => {
      const user = await createUser();
      const otherUser = await createUser({ email: 'other@example.com' });
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 1000,
          type: 'income',
          description: 'Salary',
          transactionDate: utc(currentYear, 5, 1),
        },
      ]);
      await seedRecords(otherUser.id, [
        {
          amount: 9999,
          type: 'income',
          description: 'Salary',
          transactionDate: utc(currentYear, 5, 1),
        },
        {
          amount: 5000,
          type: 'outgoing',
          typeCategory: 'essential',
          description: 'Mortgage',
          transactionDate: utc(currentYear, 5, 2),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.income.total).toBe(1000);
      expect(response.body.yourMoneyThisMonth.income.sections).toHaveLength(1);
      expect(response.body.yourMoneyThisMonth.income.sections[0].items).toEqual([
        { description: 'Salary', amount: 1000 },
      ]);
      expect(response.body.yourMoneyThisMonth.outgoing.total).toBe(0);
      expect(response.body.yourMoneyThisMonth.outgoing.sections).toEqual([]);
    });
  });

  describe('dynamic categories', () => {
    it('exposes a section for each type_category present in the data without referring to category names in code', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      const categories: FinancialRecordTypeCategory[] = [
        'essential',
        'debt-repayment',
        'discretionary',
      ];
      await seedRecords(
        user.id,
        categories.map((category, index) => ({
          amount: 100 * (index + 1),
          type: 'outgoing' as const,
          typeCategory: category,
          description: `Record ${index + 1}`,
          transactionDate: utc(currentYear, 5, index + 1),
        })),
      );

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const sections: { sectionKey: string }[] = response.body.yourMoneyThisMonth.outgoing.sections;
      const returnedKeys = sections.map((s) => s.sectionKey).sort();
      // Derive expected keys from the source enum values to prove the mapping
      // is mechanical — adding a new enum value would extend this list, not
      // require new code in the service.
      const expectedKeys = categories
        .map((c) =>
          c
            .split('-')
            .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
            .join(''),
        )
        .sort();
      expect(returnedKeys).toEqual(expectedKeys);
    });

    it('surfaces a brand new type_category value automatically, without code changes', async () => {
      // Add a category that did not exist when the service was written. The
      // service must derive sectionKey/sectionLabel from the raw value, so a
      // future enum addition lights up the response with no code changes.
      await AppDataSource.query(
        `ALTER TYPE "financial_records_type_category_enum" ADD VALUE IF NOT EXISTS 'savings-pot'`,
      );

      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      const repo = AppDataSource.getRepository(FinancialRecord);
      const transactionDate = utc(currentYear, 5, 1);
      await repo.query(
        `INSERT INTO financial_records
           (amount, type, type_category, description, transaction_date, user_id)
         VALUES ($1, 'outgoing', 'savings-pot', $2, $3, $4)`,
        ['250.00', 'Rainy day fund', transactionDate, user.id],
      );

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const sections: { sectionKey: string; sectionLabel: string; subtotal: number }[] =
        response.body.yourMoneyThisMonth.outgoing.sections;
      const newSection = sections.find((s) => s.sectionKey === 'savingsPot');
      expect(newSection).toBeDefined();
      expect(newSection).toMatchObject({
        sectionKey: 'savingsPot',
        sectionLabel: 'Savings Pot',
        subtotal: 250,
      });
    });
  });

  describe('edge cases', () => {
    it('returns empty groups when the user has no records at all', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth).toEqual({
        income: { total: 0, sections: [] },
        outgoing: { total: 0, sections: [] },
      });
    });

    it('returns empty groups when the user has no records in the requested month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      // Records exist, but in a month other than the one we ask for.
      await seedRecords(user.id, [
        {
          amount: 1000,
          type: 'income',
          transactionDate: utc(currentYear, 0, 1),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.income.total).toBe(0);
      expect(response.body.yourMoneyThisMonth.income.sections).toEqual([]);
      expect(response.body.yourMoneyThisMonth.outgoing.total).toBe(0);
      expect(response.body.yourMoneyThisMonth.outgoing.sections).toEqual([]);
    });

    it('returns a single category section when only one category has records', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 500,
          type: 'outgoing',
          typeCategory: 'essential',
          description: 'Rent',
          transactionDate: utc(currentYear, 5, 1),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.income).toEqual({
        total: 0,
        sections: [],
      });
      expect(response.body.yourMoneyThisMonth.outgoing.sections).toHaveLength(1);
      expect(response.body.yourMoneyThisMonth.outgoing.sections[0]).toEqual({
        sectionKey: 'essential',
        sectionLabel: 'Essential',
        subtotal: 500,
        items: [{ description: 'Rent', amount: 500 }],
      });
    });

    it('preserves zero-amount records as line items', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 0,
          type: 'outgoing',
          typeCategory: 'discretionary',
          description: 'Cancelled subscription',
          transactionDate: utc(currentYear, 5, 1),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.outgoing.total).toBe(0);
      expect(response.body.yourMoneyThisMonth.outgoing.sections).toEqual([
        {
          sectionKey: 'discretionary',
          sectionLabel: 'Discretionary',
          subtotal: 0,
          items: [{ description: 'Cancelled subscription', amount: 0 }],
        },
      ]);
    });

    it('defaults to the current month when no month query parameter is provided', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const now = new UTCDate();
      const currentYear = getYear(now);
      const currentMonthIndex = getMonth(now);

      // Record in the current month — should appear in the response.
      await seedRecords(user.id, [
        {
          amount: 1000,
          type: 'income',
          description: 'Salary',
          transactionDate: utc(currentYear, currentMonthIndex, 5),
        },
        // Record in a different month — should be excluded.
        {
          amount: 9999,
          type: 'income',
          description: 'Bonus',
          transactionDate: utc(currentYear, (currentMonthIndex + 6) % 12, 5),
        },
      ]);

      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.income.total).toBe(1000);
      expect(response.body.yourMoneyThisMonth.income.sections).toEqual([
        {
          sectionKey: 'income',
          sectionLabel: 'Income',
          subtotal: 1000,
          items: [{ description: 'Salary', amount: 1000 }],
        },
      ]);
    });

    it('buckets outgoing records with no type_category under an "other" section', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 75,
          type: 'outgoing',
          typeCategory: null,
          description: 'Misc',
          transactionDate: utc(currentYear, 5, 1),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.yourMoneyThisMonth.outgoing.sections).toEqual([
        {
          sectionKey: 'other',
          sectionLabel: 'Other',
          subtotal: 75,
          items: [{ description: 'Misc', amount: 75 }],
        },
      ]);
    });
  });
});
