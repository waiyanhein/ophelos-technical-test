import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

const invokeMock = jest.fn();
const createChatModelMock = jest.fn(() => ({ invoke: invokeMock }));

jest.mock('../../src/services/llm/chat-model', () => ({
  createChatModel: () => createChatModelMock(),
}));

import {
  RecommendationInput,
  buildRecommendationPrompt,
  getRecommendations,
} from '../../src/services/recommendations.service';
import type { FinancialHealthSummary } from '../../src/services/financial.service';

const baseHealth = (overrides: Partial<FinancialHealthSummary> = {}): FinancialHealthSummary => ({
  rating: 'amber',
  income: 2800,
  essentialSpend: 1450,
  debtRepayments: 1000,
  discretionarySpend: 15,
  surplusAfterEssentials: 1350,
  headroom: 350,
  headroomRatio: 0.125,
  disposableIncome: 335,
  ...overrides,
});

const baseInput = (overrides: Partial<RecommendationInput> = {}): RecommendationInput => ({
  health: baseHealth(),
  discretionaryItems: [{ description: 'Netflix', amount: 15 }],
  ...overrides,
});

beforeEach(() => {
  invokeMock.mockReset();
  createChatModelMock.mockClear();
  createChatModelMock.mockImplementation(() => ({ invoke: invokeMock }));
});

describe('buildRecommendationPrompt', () => {
  it('includes every line item by description and amount in the user prompt', () => {
    const prompt = buildRecommendationPrompt(
      baseInput({
        discretionaryItems: [
          { description: 'Netflix', amount: 15 },
          { description: 'Disney+', amount: 8.99 },
          { description: 'Amazon Prime', amount: 9 },
        ],
      }),
    );
    expect(prompt.user).toContain('Netflix: £15.00');
    expect(prompt.user).toContain('Disney+: £8.99');
    expect(prompt.user).toContain('Amazon Prime: £9.00');
  });

  it('includes the rating label and headroom ratio in the user prompt', () => {
    const prompt = buildRecommendationPrompt(
      baseInput({ health: baseHealth({ rating: 'amber', headroomRatio: 0.125 }) }),
    );
    expect(prompt.user).toContain('AMBER');
    expect(prompt.user).toContain('12.5%');
  });

  it('uses urgent tone guidance for a red rating', () => {
    const prompt = buildRecommendationPrompt(baseInput({ health: baseHealth({ rating: 'red' }) }));
    expect(prompt.system).toMatch(/URGENT/);
  });

  it('uses supportive, measured tone guidance for a green rating', () => {
    const prompt = buildRecommendationPrompt(
      baseInput({ health: baseHealth({ rating: 'green' }) }),
    );
    expect(prompt.system).toMatch(/SUPPORTIVE AND MEASURED/);
  });

  it('uses pragmatic tone guidance for an amber rating', () => {
    const prompt = buildRecommendationPrompt(
      baseInput({ health: baseHealth({ rating: 'amber' }) }),
    );
    expect(prompt.system).toMatch(/HONEST AND PRACTICAL/);
  });

  it('marks the items section as "none" when the user has no discretionary spending', () => {
    const prompt = buildRecommendationPrompt(baseInput({ discretionaryItems: [] }));
    expect(prompt.user).toContain('(none');
  });

  it('always asks the model to return strict JSON only', () => {
    const prompt = buildRecommendationPrompt(baseInput());
    expect(prompt.system).toMatch(/STRICT JSON only/);
    expect(prompt.system).toMatch(/recommendations/);
  });
});

describe('getRecommendations', () => {
  it('skips the LLM call entirely when there are no discretionary items', async () => {
    const result = await getRecommendations(baseInput({ discretionaryItems: [] }));
    expect(result).toEqual([]);
    expect(createChatModelMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('calls the chat model exactly once with system + human messages built from the prompt', async () => {
    invokeMock.mockResolvedValue(
      new AIMessage('{"recommendations":["Cancel Netflix to save £15 a month."]}'),
    );

    await getRecommendations(baseInput());

    expect(createChatModelMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    const messages = invokeMock.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBeInstanceOf(SystemMessage);
    expect(messages[1]).toBeInstanceOf(HumanMessage);
    expect(messages[1].content).toContain('Netflix');
  });

  it('parses a JSON object payload and returns the recommendations array', async () => {
    invokeMock.mockResolvedValue(
      new AIMessage('{"recommendations":["Cut Netflix (£15)","Pause Disney+ (£8.99)"]}'),
    );
    const result = await getRecommendations(baseInput());
    expect(result).toEqual(['Cut Netflix (£15)', 'Pause Disney+ (£8.99)']);
  });

  it('strips markdown fences before parsing the model response', async () => {
    invokeMock.mockResolvedValue(
      new AIMessage('```json\n{"recommendations":["Drop one streaming service."]}\n```'),
    );
    const result = await getRecommendations(baseInput());
    expect(result).toEqual(['Drop one streaming service.']);
  });

  it('returns an empty array when the model returns malformed output', async () => {
    invokeMock.mockResolvedValue(new AIMessage('not json at all'));
    const result = await getRecommendations(baseInput());
    expect(result).toEqual([]);
  });

  it('drops non-string entries from the recommendations array defensively', async () => {
    invokeMock.mockResolvedValue(
      new AIMessage('{"recommendations":["Real suggestion",42,null,"Another"]}'),
    );
    const result = await getRecommendations(baseInput());
    expect(result).toEqual(['Real suggestion', 'Another']);
  });
});
