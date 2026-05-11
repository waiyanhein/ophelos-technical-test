import { withDatabase, withMockDateAll } from '../../utilities';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { createUser, seedRecords, tokenForUser, utc } from './helpers';
import { loadConfig } from '../../../src/config/env';
import { UTCDate } from '@date-fns/utc';
import { addDays, getYear } from 'date-fns';
import * as cryptoService from '../../../src/services/crypto.service';
import { AppDataSource } from '../../../src/data-source';
import { SharableLink } from '../../../src/entities/sharable-link.entity';
import { FinancialStatement } from '../../../src/entities/financial-statement.entity';
import { getDashboard } from '../../../src/services/financial.service';

const fakeToken = `Q7j5J0Qv4x6M6n6A5h3q9Q2kWmTnQ7j5J0Qv4x6M6n6A5h3q9Q2kWmTn`;

const sharableLinkRepository = AppDataSource.getRepository(SharableLink);
const financialStatementRepository = AppDataSource.getRepository(FinancialStatement);

/**
 * @TODO - cover more edge cases such as database transactions and errors
 */
describe('POST /financial/sharable-statement', () => {
  const mockDate = new UTCDate(2026, 0, 1);
  withMockDateAll(mockDate);
  withDatabase();
  beforeEach(() => {
    jest.spyOn(cryptoService, 'generateUrlSafeToken').mockReturnValue(fakeToken);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('authentication', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      const response = await request(createApp()).post('/financial/sharable-statement');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Missing or malformed authorization header',
      });
    });

    it('returns 401 when the Authorization header is malformed', async () => {
      const response = await request(createApp())
        .post('/financial/sharable-statement')
        .set('Authorization', 'NotBearer abc');
      expect(response.status).toBe(401);
    });

    it('returns 401 when the JWT signature is invalid', async () => {
      const response = await request(createApp())
        .post('/financial/sharable-statement')
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
        .post('/financial/sharable-statement')
        .set('Authorization', `Bearer ${expired}`);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token has expired' });
    });
  });

  it(`should generate financial statement and return sharable link token`, async () => {
    const user = await createUser();
    const token = tokenForUser(user);
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

    const response = await request(createApp())
      .post('/financial/sharable-statement')
      .set('Authorization', `Bearer ${token}`)
      .send({
        month: '01',
        year: currentYear.toString(),
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: fakeToken,
    });
    /**
     * @IMPORTANT - it's better to use hardcoded exppected data rather than relying on the service layer to generate the data
     * as tests can return false positives if the service layer is not perfect.
     * Now it's assuming that getDashboard is perfect and returns the expected data.
     */
    const expectedDashboard = await getDashboard({
      userId: user.id,
      month: 1,
      year: currentYear,
    });
    expect(expectedDashboard.financialHealthStatus).toBeDefined();
    expect(expectedDashboard.financialHealthStatus).toBeDefined();
    expect(expectedDashboard.recommendations).toBeDefined();
    expect(expectedDashboard.overTimeProgress).toBeDefined();
    expect(expectedDashboard.yourMoneyThisMonth).toBeDefined();
    const sharableLinks = await sharableLinkRepository.find();
    expect(sharableLinks).toHaveLength(1);
    const financialStatements = await financialStatementRepository.find();
    expect(financialStatements).toHaveLength(1);
    const financialStatement = financialStatements[0];
    expect(financialStatement.userId).toEqual(user.id);
    expect(financialStatement.data).toEqual(expectedDashboard);
    expect(financialStatement.createdAt).toEqual(mockDate);
    const sharableLink = sharableLinks[0];
    expect(sharableLink.token).toEqual(fakeToken);
    expect(sharableLink.expiresAt).toEqual(addDays(mockDate, 7));
    expect(sharableLink.createdAt).toEqual(mockDate);
    expect(sharableLink.financialStatementId).toEqual(financialStatement.id);
  });
});
