jest.mock('../../../../src/services/recommendations.service', () => ({
  getRecommendations: jest.fn().mockResolvedValue([]),
}));

import { UTCDate } from '@date-fns/utc';
import { getMonth, getYear } from 'date-fns';
import request from 'supertest';
import { createApp } from '../../../../src/app';
import { withDatabase } from '../../../utilities';
import { RecordSeed, createUser, seedRecords, tokenForUser, utc } from '../helpers';

describe('GET /financial/dashboard — overTimeProgress (integration)', () => {
  withDatabase();

  describe('response shape and business logic', () => {
    it('returns the last 6 months ending at the supplied month, most recent first', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

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
        .get(`/financial/dashboard?month=03&year=${currentYear}`)
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

    it('defaults to the current month and year when no month and year query parameters are provided', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const now = new UTCDate();
      const currentYear = getYear(now);
      const currentMonthIndex = getMonth(now);

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
      const currentYear = getYear(new UTCDate());

      // Each month pairs income with outgoings so disposable = income - outgoing
      // exercises both sides of the formula (not just income totals).
      // Disposable incomes (Jan→Jun): 200, 600, 1000, 1500, 800, 400.
      // Up Jan→Apr (peak), down Apr→Jun. Min=200, Max=1500, range=1300.
      await seedRecords(user.id, [
        // Jan: 1200 - 1000 = 200
        { amount: 1200, type: 'income', transactionDate: utc(currentYear, 0, 5) },
        { amount: 1000, type: 'outgoing', transactionDate: utc(currentYear, 0, 20) },
        // Feb: 1500 - 900 = 600
        { amount: 1500, type: 'income', transactionDate: utc(currentYear, 1, 5) },
        { amount: 900, type: 'outgoing', transactionDate: utc(currentYear, 1, 20) },
        // Mar: 2000 - 1000 = 1000
        { amount: 2000, type: 'income', transactionDate: utc(currentYear, 2, 5) },
        { amount: 1000, type: 'outgoing', transactionDate: utc(currentYear, 2, 20) },
        // Apr: 2500 - 1000 = 1500 (peak)
        { amount: 2500, type: 'income', transactionDate: utc(currentYear, 3, 5) },
        { amount: 1000, type: 'outgoing', transactionDate: utc(currentYear, 3, 20) },
        // May: 1800 - 1000 = 800
        { amount: 1800, type: 'income', transactionDate: utc(currentYear, 4, 5) },
        { amount: 1000, type: 'outgoing', transactionDate: utc(currentYear, 4, 20) },
        // Jun: 1400 - 1000 = 400
        { amount: 1400, type: 'income', transactionDate: utc(currentYear, 5, 5) },
        { amount: 1000, type: 'outgoing', transactionDate: utc(currentYear, 5, 20) },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=06&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const points = response.body.overTimeProgress.map(
        (p: { progress: number; disposable_income: number }) => ({
          progress: p.progress,
          disposable_income: p.disposable_income,
        }),
      );
      // Returned newest → oldest: Jun, May, Apr (peak), Mar, Feb, Jan (min).
      expect(points).toEqual([
        { progress: 15, disposable_income: 400 },
        { progress: 46, disposable_income: 800 },
        { progress: 100, disposable_income: 1500 },
        { progress: 62, disposable_income: 1000 },
        { progress: 31, disposable_income: 600 },
        { progress: 0, disposable_income: 200 },
      ]);
    });

    it('returns 50 for every period when all months have equal disposable income', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

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
        .get(`/financial/dashboard?month=06&year=${currentYear}`)
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
      const currentYear = getYear(new UTCDate());

      const response = await request(createApp())
        .get(`/financial/dashboard?month=06&year=${currentYear}`)
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

    it('leaves gap months at zero when only some months in the window have records', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      // Window for month=03: Oct (prev year) through Mar (current year).
      // Only Oct and Feb have records; Nov, Dec, Jan, Mar are gaps.
      // Oct disposable = 1000 - 200 = 800; Feb disposable = 1500 - 500 = 1000.
      // Gap months disposable = 0.
      // Window min = 0, max = 1000, range = 1000.
      // Progress: Feb = 100, Oct = 80, gaps = 0.
      await seedRecords(user.id, [
        { amount: 1000, type: 'income', transactionDate: utc(currentYear - 1, 9, 5) },
        { amount: 200, type: 'outgoing', transactionDate: utc(currentYear - 1, 9, 20) },
        { amount: 1500, type: 'income', transactionDate: utc(currentYear, 1, 5) },
        { amount: 500, type: 'outgoing', transactionDate: utc(currentYear, 1, 20) },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=03&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.overTimeProgress).toEqual([
        { period: `Mar ${currentYear}`, progress: 0, disposable_income: 0, is_now: false },
        { period: `Feb ${currentYear}`, progress: 100, disposable_income: 1000, is_now: false },
        { period: `Jan ${currentYear}`, progress: 0, disposable_income: 0, is_now: false },
        { period: `Dec ${currentYear - 1}`, progress: 0, disposable_income: 0, is_now: false },
        { period: `Nov ${currentYear - 1}`, progress: 0, disposable_income: 0, is_now: false },
        { period: `Oct ${currentYear - 1}`, progress: 80, disposable_income: 800, is_now: false },
      ]);
    });

    it('returns progress 0 when income is zero but outgoings exist', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        {
          amount: 250,
          type: 'outgoing',
          transactionDate: utc(currentYear, 5, 5),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=06&year=${currentYear}`)
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
      const currentYear = getYear(new UTCDate());

      await seedRecords(otherUser.id, [
        {
          amount: 9999,
          type: 'income',
          transactionDate: utc(currentYear, 5, 1),
        },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=06&year=${currentYear}`)
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
      const currentYear = getYear(new UTCDate());

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
        .get(`/financial/dashboard?month=06&year=${currentYear}`)
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
      const currentYear = getYear(new UTCDate());

      // Asking for month=02 with 6 months lookback → Sep prev year through Feb current year.
      await seedRecords(user.id, [
        { amount: 1000, type: 'income', transactionDate: utc(currentYear - 1, 8, 15) },
        { amount: 1000, type: 'income', transactionDate: utc(currentYear, 1, 15) },
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=02&year=${currentYear}`)
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
