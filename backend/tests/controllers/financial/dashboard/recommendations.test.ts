import { UTCDate } from '@date-fns/utc';
import { AIMessage, BaseMessage, SystemMessage, HumanMessage } from '@langchain/core/messages';
import { getYear } from 'date-fns';
import request from 'supertest';

const invokeMock = jest.fn<Promise<BaseMessage>, [BaseMessage[]]>();
const createChatModelMock = jest.fn(() => ({ invoke: invokeMock }));

jest.mock('../../../../src/services/llm/chat-model', () => ({
  createChatModel: () => createChatModelMock(),
}));

import { createApp } from '../../../../src/app';
import { withDatabase } from '../../../utilities';
import { createUser, monthQuery, seedRecords, tokenForUser, utc } from '../helpers';

const replyWith = (recommendations: string[]): void => {
  invokeMock.mockResolvedValue(new AIMessage(JSON.stringify({ recommendations })));
};

beforeEach(() => {
  invokeMock.mockReset();
  createChatModelMock.mockClear();
  createChatModelMock.mockImplementation(() => ({ invoke: invokeMock }));
});

/**
 * @TODO - add more tests - such as it invokes the LLM with the correct messages and input data (cover prompts);
 */
describe('GET /financial/dashboard — recommendations (integration)', () => {
  withDatabase();

  it('returns LLM-generated recommendations alongside the existing widget data', async () => {
    replyWith([
      'Cancel one of your three streaming subscriptions to save around £24 a month.',
      'Reduce dining out — even one fewer meal frees up £30 toward your loan.',
    ]);

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
        amount: 1450,
        type: 'outgoing',
        typeCategory: 'essential',
        description: 'Rent',
        transactionDate: utc(currentYear, 5, 2),
      },
      {
        amount: 1000,
        type: 'outgoing',
        typeCategory: 'debt-repayment',
        description: 'Loan repayment',
        transactionDate: utc(currentYear, 5, 3),
      },
      {
        amount: 15,
        type: 'outgoing',
        typeCategory: 'discretionary',
        description: 'Netflix',
        transactionDate: utc(currentYear, 5, 4),
      },
      {
        amount: 9,
        type: 'outgoing',
        typeCategory: 'discretionary',
        description: 'Disney+',
        transactionDate: utc(currentYear, 5, 5),
      },
      {
        amount: 9,
        type: 'outgoing',
        typeCategory: 'discretionary',
        description: 'Amazon Prime',
        transactionDate: utc(currentYear, 5, 6),
      },
    ]);

    const response = await request(createApp())
      .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.recommendations).toEqual([
      'Cancel one of your three streaming subscriptions to save around £24 a month.',
      'Reduce dining out — even one fewer meal frees up £30 toward your loan.',
    ]);
    expect(response.body.yourMoneyThisMonth).toBeDefined();
    expect(response.body.overTimeProgress).toBeDefined();
  });

  it('calls the chat model exactly once and passes both system + human messages', async () => {
    replyWith(['One concise suggestion.']);

    const user = await createUser();
    const token = tokenForUser(user);
    const currentYear = getYear(new UTCDate());

    await seedRecords(user.id, [
      { amount: 2800, type: 'income', transactionDate: utc(currentYear, 5, 1) },
      {
        amount: 50,
        type: 'outgoing',
        typeCategory: 'discretionary',
        description: 'Spotify Family',
        transactionDate: utc(currentYear, 5, 2),
      },
    ]);

    await request(createApp())
      .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(createChatModelMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    const messages = invokeMock.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    // The actual line items must be passed through to the LLM so its
    // suggestions are grounded in the user's real data.
    expect(messages[1].content).toContain('Spotify Family');
  });

  describe('edge cases', () => {
    it('returns an empty recommendations array and does NOT call the LLM when the user has no discretionary spending', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      await seedRecords(user.id, [
        { amount: 2800, type: 'income', transactionDate: utc(currentYear, 5, 1) },
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
      ]);

      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toEqual([]);
      expect(createChatModelMock).not.toHaveBeenCalled();
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('returns an empty recommendations array on empty financial records (no income, no outgoings)', async () => {
      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());
      const response = await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.recommendations).toEqual([]);
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('passes URGENT tone guidance to the LLM when the user has a RED rating', async () => {
      replyWith([
        'Cancel every non-essential subscription this week — your debt repayment is at risk.',
      ]);

      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      // Income £1500, essentials £1300, debt £200 → headroom 0 → red.
      // Plus discretionary so the LLM is invoked.
      await seedRecords(user.id, [
        { amount: 1500, type: 'income', transactionDate: utc(currentYear, 5, 1) },
        {
          amount: 1300,
          type: 'outgoing',
          typeCategory: 'essential',
          description: 'Rent',
          transactionDate: utc(currentYear, 5, 2),
        },
        {
          amount: 200,
          type: 'outgoing',
          typeCategory: 'debt-repayment',
          description: 'Loan',
          transactionDate: utc(currentYear, 5, 3),
        },
        {
          amount: 50,
          type: 'outgoing',
          typeCategory: 'discretionary',
          description: 'Subscriptions',
          transactionDate: utc(currentYear, 5, 4),
        },
      ]);

      await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(invokeMock).toHaveBeenCalledTimes(1);
      const systemMessage = invokeMock.mock.calls[0][0][0];
      expect(systemMessage.content).toMatch(/URGENT/);
      expect(systemMessage.content).not.toMatch(/SUPPORTIVE AND MEASURED/);
    });

    it('passes SUPPORTIVE AND MEASURED tone guidance to the LLM when the user has a GREEN rating', async () => {
      replyWith(['You could redirect £20 from streaming toward extra debt repayment.']);

      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      // Income £4000, essentials £1000, debt £500 → headroom £2500 (62.5%) → green.
      await seedRecords(user.id, [
        { amount: 4000, type: 'income', transactionDate: utc(currentYear, 5, 1) },
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
          amount: 20,
          type: 'outgoing',
          typeCategory: 'discretionary',
          description: 'Netflix',
          transactionDate: utc(currentYear, 5, 4),
        },
      ]);

      await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(invokeMock).toHaveBeenCalledTimes(1);
      const systemMessage = invokeMock.mock.calls[0][0][0];
      expect(systemMessage.content).toMatch(/SUPPORTIVE AND MEASURED/);
      expect(systemMessage.content).not.toMatch(/URGENT/);
    });

    it('passes the AMBER tone (honest and practical) to the LLM when the user is on a thin buffer', async () => {
      replyWith(['Trim two of your three streaming subscriptions to widen your buffer.']);

      const user = await createUser();
      const token = tokenForUser(user);
      const currentYear = getYear(new UTCDate());

      // The spec example: income £2800, essentials £1450, debt £1000, headroom £350 (12.5%).
      await seedRecords(user.id, [
        { amount: 2800, type: 'income', transactionDate: utc(currentYear, 5, 1) },
        {
          amount: 1450,
          type: 'outgoing',
          typeCategory: 'essential',
          description: 'Rent',
          transactionDate: utc(currentYear, 5, 2),
        },
        {
          amount: 1000,
          type: 'outgoing',
          typeCategory: 'debt-repayment',
          description: 'Loan',
          transactionDate: utc(currentYear, 5, 3),
        },
        {
          amount: 15,
          type: 'outgoing',
          typeCategory: 'discretionary',
          description: 'Netflix',
          transactionDate: utc(currentYear, 5, 4),
        },
      ]);

      await request(createApp())
        .get(`/financial/dashboard?month=${monthQuery(5)}&year=${currentYear}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const systemMessage = invokeMock.mock.calls[0][0][0];
      expect(systemMessage.content).toMatch(/HONEST AND PRACTICAL/);
    });
  });
});
