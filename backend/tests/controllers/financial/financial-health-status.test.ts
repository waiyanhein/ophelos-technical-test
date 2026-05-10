jest.mock('../../../src/services/recommendations.service', () => ({
  getRecommendations: jest.fn().mockResolvedValue([]),
}));

import { UTCDate } from '@date-fns/utc';
import { getYear } from 'date-fns';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { withDatabase } from '../../utilities';
import { createUser, monthQuery, seedRecords, tokenForUser, utc } from './helpers';

describe('GET /financial/dashboard — financialHealthStatus (integration)', () => {
  withDatabase();

  it('exposes the spec-worked-example as an amber, limited-buffer status', async () => {
    const user = await createUser();
    const token = tokenForUser(user);
    const currentYear = getYear(new UTCDate());

    // From the brief: income £2800, essentials £1450, debt £1000,
    // discretionary £15 → headroom £350 (12.5%) → amber.
    await seedRecords(user.id, [
      {
        amount: 2800,
        type: 'income',
        description: 'Salary',
        transactionDate: utc(currentYear, 5, 1),
      },
      {
        amount: 900,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Rent',
        transactionDate: utc(currentYear, 5, 2),
      },
      {
        amount: 400,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Food',
        transactionDate: utc(currentYear, 5, 3),
      },
      {
        amount: 150,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Travel',
        transactionDate: utc(currentYear, 5, 4),
      },
      {
        amount: 1000,
        type: 'outgoing',
        typeCategory: 'debt-repayment',
        description: 'Loan repayment',
        transactionDate: utc(currentYear, 5, 5),
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
    expect(response.body.financialHealthStatus).toMatchObject({
      rating: 'amber',
      badgeTone: 'warning',
      income: 2800,
      essentialSpend: 1450,
      debtRepayments: 1000,
      discretionarySpend: 15,
      headroom: 350,
      disposableIncome: 335, // 2800 − 1450 − 1000 − 15
    });
    expect(response.body.financialHealthStatus.headroomRatio).toBeCloseTo(0.125, 4);
    expect(response.body.financialHealthStatus.badgeLabel).toMatch(/buffer/i);
    expect(response.body.financialHealthStatus.headline).toBeTruthy();
    expect(response.body.financialHealthStatus.body).toBeTruthy();
  });

  it('returns a red, under-pressure status when the user cannot comfortably afford their debt repayments', async () => {
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
        amount: 1300,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Rent',
        transactionDate: utc(currentYear, 5, 2),
      },
      {
        amount: 300,
        type: 'outgoing',
        typeCategory: 'debt-repayment',
        description: 'Loan',
        transactionDate: utc(currentYear, 5, 3),
      },
    ]);

    const response = await request(createApp())
      .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.financialHealthStatus.rating).toBe('red');
    expect(response.body.financialHealthStatus.badgeTone).toBe('danger');
    expect(response.body.financialHealthStatus.disposableIncome).toBe(-100);
  });

  it('returns a green, on-track status when the user has a comfortable buffer', async () => {
    const user = await createUser();
    const token = tokenForUser(user);
    const currentYear = getYear(new UTCDate());

    await seedRecords(user.id, [
      {
        amount: 4000,
        type: 'income',
        description: 'Salary',
        transactionDate: utc(currentYear, 5, 1),
      },
      {
        amount: 1000,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Rent',
        transactionDate: utc(currentYear, 5, 2),
      },
      {
        amount: 500,
        type: 'outgoing',
        typeCategory: 'debt-repayment',
        description: 'Loan',
        transactionDate: utc(currentYear, 5, 3),
      },
      {
        amount: 200,
        type: 'outgoing',
        typeCategory: 'discretionary',
        description: 'Eating out',
        transactionDate: utc(currentYear, 5, 4),
      },
    ]);

    const response = await request(createApp())
      .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.financialHealthStatus.rating).toBe('green');
    expect(response.body.financialHealthStatus.badgeTone).toBe('success');
    expect(response.body.financialHealthStatus.disposableIncome).toBe(2300); // 4000 − 1700
  });

  it('returns a red status with zero disposable income when the user has no records at all', async () => {
    const user = await createUser();
    const token = tokenForUser(user);
    const currentYear = getYear(new UTCDate());

    const response = await request(createApp())
      .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.financialHealthStatus).toMatchObject({
      rating: 'red',
      badgeTone: 'danger',
      income: 0,
      disposableIncome: 0,
    });
  });

  it("matches the over-time-progress widget's disposable-income for the current month", async () => {
    const user = await createUser();
    const token = tokenForUser(user);
    const currentYear = getYear(new UTCDate());

    // Use the current month so the financial-health widget and the
    // over-time-progress widget compute the same period.
    const now = new UTCDate();
    const month = now.getUTCMonth();

    await seedRecords(user.id, [
      {
        amount: 3100,
        type: 'income',
        description: 'Salary',
        transactionDate: utc(currentYear, month, 1),
      },
      {
        amount: 1250,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Rent',
        transactionDate: utc(currentYear, month, 2),
      },
      {
        amount: 1000,
        type: 'outgoing',
        typeCategory: 'debt-repayment',
        description: 'Loan',
        transactionDate: utc(currentYear, month, 3),
      },
      {
        amount: 182,
        type: 'outgoing',
        typeCategory: 'discretionary',
        description: 'Streaming',
        transactionDate: utc(currentYear, month, 4),
      },
    ]);

    const response = await request(createApp())
      .get('/financial/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const currentPoint = response.body.overTimeProgress.find((p: { is_now: boolean }) => p.is_now);
    expect(currentPoint).toBeDefined();
    expect(response.body.financialHealthStatus.disposableIncome).toBe(
      currentPoint.disposable_income,
    );
  });
});
