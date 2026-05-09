import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel } from './llm/chat-model';
import type {
  DiscretionaryItem,
  FinancialHealthRating,
  FinancialHealthSummary,
} from './financial.service';

export interface RecommendationInput {
  health: FinancialHealthSummary;
  discretionaryItems: DiscretionaryItem[];
}

export interface RecommendationPrompt {
  system: string;
  user: string;
}

const TONE_GUIDANCE: Record<FinancialHealthRating, string> = {
  red: [
    'TONE: URGENT. The user cannot comfortably afford their debt repayments.',
    'Be direct and clear that change is needed now. Do not soften the message,',
    'but do not shame the user either. Focus on the largest, fastest cuts that',
    'will free up cash this month.',
  ].join(' '),
  amber: [
    'TONE: HONEST AND PRACTICAL. The user can afford their debts but has only a',
    'thin buffer. Recommend pragmatic trims that build a margin of safety,',
    'without alarming them.',
  ].join(' '),
  green: [
    'TONE: SUPPORTIVE AND MEASURED. The user has a comfortable buffer. Avoid',
    'urgency. Suggest small optimisations that could accelerate debt payoff,',
    'and acknowledge they are doing well.',
  ].join(' '),
};

const SYSTEM_PROMPT_BASE = [
  'You are a financial wellbeing assistant helping a user manage their way out of debt.',
  "Your job: read the user's financial snapshot and produce 2–4 specific, actionable",
  'suggestions to change their DISCRETIONARY spending in order to accelerate debt repayment.',
  '',
  'Rules:',
  '- Ground every suggestion in the actual line items provided. Name them. Do not invent items.',
  '- Be SPECIFIC about how much money each suggestion would free up per month.',
  '- Never suggest cutting essentials or debt repayments — those are off-limits.',
  '- If the user has no discretionary spending, return an empty list.',
  '- Each suggestion must be a single short sentence (≤ 25 words). Plain text. No emojis.',
  '- Output STRICT JSON only, no prose, no markdown fences. Schema: {"recommendations": string[]}.',
].join('\n');

export const buildRecommendationPrompt = (input: RecommendationInput): RecommendationPrompt => {
  const { health, discretionaryItems } = input;

  const system = [SYSTEM_PROMPT_BASE, '', TONE_GUIDANCE[health.rating]].join('\n');

  const ratingLabel = `${health.rating.toUpperCase()} (${ratingMeaning(health.rating)})`;

  const itemsBlock =
    discretionaryItems.length === 0
      ? '(none — the user has no discretionary spending this month)'
      : discretionaryItems
          .map((item) => `- ${item.description}: £${item.amount.toFixed(2)}`)
          .join('\n');

  const user = [
    `Financial health rating: ${ratingLabel}`,
    `Income this month: £${health.income.toFixed(2)}`,
    `Essential spend: £${health.essentialSpend.toFixed(2)}`,
    `Debt repayments: £${health.debtRepayments.toFixed(2)}`,
    `Discretionary spend: £${health.discretionarySpend.toFixed(2)}`,
    `Surplus after essentials: £${health.surplusAfterEssentials.toFixed(2)}`,
    `Headroom (after debt): £${health.headroom.toFixed(2)} (${(health.headroomRatio * 100).toFixed(1)}% of income)`,
    '',
    'Discretionary line items:',
    itemsBlock,
    '',
    'Return JSON only.',
  ].join('\n');

  return { system, user };
};

const ratingMeaning = (rating: FinancialHealthRating): string => {
  switch (rating) {
    case 'red':
      return 'cannot comfortably afford debt repayments';
    case 'amber':
      return 'manageable but limited buffer';
    case 'green':
      return 'comfortable, meaningful buffer';
  }
};

// The LLM is instructed to reply with JSON only, but real models occasionally
// wrap output in markdown fences or leading prose. Strip the obvious patterns
// before parsing, and fall back to an empty list rather than failing the whole
// dashboard endpoint if the model misbehaves.
const parseRecommendations = (raw: string): string[] => {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : raw).trim();
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'recommendations' in parsed &&
      Array.isArray((parsed as { recommendations: unknown }).recommendations)
    ) {
      return (parsed as { recommendations: unknown[] }).recommendations
        .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
        .map((r) => r.trim());
    }
  } catch {
    // fall through
  }
  return [];
};

const extractText = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          const text = (part as { text: unknown }).text;
          return typeof text === 'string' ? text : '';
        }
        return '';
      })
      .join('');
  }
  return '';
};

export const getRecommendations = async (input: RecommendationInput): Promise<string[]> => {
  // No discretionary items → no negotiable spend to talk about. Skip the LLM
  // call entirely so we don't pay for a request that has nothing to recommend.
  if (input.discretionaryItems.length === 0) {
    return [];
  }

  const prompt = buildRecommendationPrompt(input);
  const model = createChatModel();
  const response = await model.invoke([
    new SystemMessage(prompt.system),
    new HumanMessage(prompt.user),
  ]);

  return parseRecommendations(extractText(response.content));
};
