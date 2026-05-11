import { UTCDate } from '@date-fns/utc';
import { withDatabase, withMockDateAll } from '../../utilities';
import { createUser, seedRecords, utc } from './helpers';
import { addDays, getYear } from 'date-fns';
import { AppDataSource } from '../../../src/data-source';
import { SharableLink } from '../../../src/entities/sharable-link.entity';
import { FinancialStatement } from '../../../src/entities/financial-statement.entity';
import { getDashboard } from '../../../src/services/financial.service';
import { createApp } from '../../../src/app';
import request from 'supertest';

const fakeToken = `Q7j5J0Qv4x6M6n6A5h3q9Q2kWmTnQ7j5J0Qv4x6M6n6A5h3q9Q2kWmTn`;
const sharableLinkRespository = AppDataSource.getRepository(SharableLink);
const financialStatementRespository = AppDataSource.getRepository(FinancialStatement);

/**
 * @TODO - cover validation errors and other edge cases.
 */
describe('GET /financial/sharable-statement/:token', () => {
  const mockDate = new UTCDate(2026, 0, 1);
  withMockDateAll(mockDate);
  withDatabase();

  it(`should return the financial statement data if the token is valid`, async () => {
    const user = await createUser();
    const currentYear = getYear(new UTCDate());
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

    /**
     * @IMPORTANT - it's better to use hardcoded exppected data rather than relying on the service layer to generate the data
     * as tests can return false positives if the service layer is not perfect.
     * Now it's assuming that getDashboard is perfect and returns the expected data.
     */
    const dashboard = await getDashboard({
      userId: user.id,
      month: 1,
      year: currentYear,
    });

    const statement = await financialStatementRespository.save({
      userId: user.id,
      data: dashboard,
      createdAt: mockDate,
    });

    await sharableLinkRespository.save({
      financialStatementId: statement.id,
      token: fakeToken,
      expiresAt: addDays(mockDate, 7),
      createdAt: mockDate,
    });

    const response = await request(createApp())
      .get('/financial/sharable-statement')
      .query({ token: fakeToken });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: statement.id,
      data: dashboard,
      createdAt: mockDate.toISOString(),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  });

  it(`should return error if the token is not provided`, async () => {
    await createUser();
    const response = await request(createApp()).get('/financial/sharable-statement');
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Token is required' });
  });

  it(`should return error if the token does not exist`, async () => {
    await createUser();
    const response = await request(createApp())
      .get('/financial/sharable-statement')
      .query({ token: 'invalid-token' });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Sharable link not found' });
  });

  it(`should return error if the token is expired`, async () => {
    const user = await createUser();
    const currentYear = getYear(new UTCDate());

    const dashboard = await getDashboard({
      userId: user.id,
      month: 1,
      year: currentYear,
    });

    const statement = await financialStatementRespository.save({
      userId: user.id,
      data: dashboard,
      createdAt: mockDate,
    });

    await sharableLinkRespository.save({
      financialStatementId: statement.id,
      token: fakeToken,
      expiresAt: addDays(mockDate, -1),
      createdAt: mockDate,
    });

    const response = await request(createApp())
      .get('/financial/sharable-statement')
      .query({ token: fakeToken });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: 'Sharable link has expired',
    });
  });
});
