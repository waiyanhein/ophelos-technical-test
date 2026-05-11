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

const SYSTEM_PROMPT_BASE = `
You are a financial wellbeing assistant helping users reduce debt faster.

Your task:
Read the user's financial records and generate 2–4 highly specific recommendations
to reduce discretionary spending and accelerate debt repayment.

A recommendation is only valid if it references ACTUAL spending items from the input data.

Goals:
- Maximise potential monthly savings
- Focus on the highest-impact discretionary spending
- Give practical, personalised suggestions grounded in the user's real transactions

Rules:
- ONLY use merchants, categories, and transactions explicitly present in the input.
- NEVER invent spending items.
- NEVER suggest reducing essentials:
  rent, utilities, groceries, insurance, medical costs,
  transport to work, childcare, or debt repayments.
- Focus on discretionary spending:
  dining out, takeaways, subscriptions, entertainment,
  shopping, gaming, alcohol, coffee, hobbies, etc.
- Prefer recommendations that save the MOST money.
- Prioritise recurring spending over one-off purchases.
- Ignore tiny discretionary expenses if much larger spending opportunities exist.
- Do NOT recommend cancelling low-cost subscriptions when dining,
  shopping, or takeaway spending is substantially higher.
- Group related discretionary spending together whenever possible.
- Mention exact merchants/categories and exact amounts.
- Quantify possible monthly savings clearly.
- NEVER give vague category-only advice like:
  "reduce food spending"
  "cut entertainment costs"
  "spend less money"
- NEVER recommend reducing a category unless supporting transactions are referenced.
- Recommendations must feel personal and grounded in the actual data.
- Keep each recommendation to ONE sentence under 35 words.
- Plain text only.
- No emojis.

Output format:
Return STRICT JSON only:
{"recommendations": string[]}

Good example:

Input:
- Netflix £15/month
- Spotify £9/month
- Disney+ £8/month

Good output:
{
  "recommendations": [
    "Netflix (£15), Spotify (£9), and Disney+ (£8) total £32/month — cancelling one subscription could free up extra debt repayment money."
  ]
}

Input:
- Starbucks £78
- Pret £64
- Costa £42

Good output:
{
  "recommendations": [
    "Coffee purchases from Starbucks (£78), Pret (£64), and Costa (£42) total £184/month — reducing takeaway coffees could accelerate repayments."
  ]
}

Input:
- Netflix £9
- Restaurants £420
- Uber Eats £180

Good output:
{
  "recommendations": [
    "Restaurant spending (£420) and Uber Eats (£180) total £600/month — reducing dining out and takeaways could make a major impact on debt repayment."
  ]
}

Bad outputs:
- "Reduce food spending by £200."
- "Spend less on subscriptions."
- "Cut unnecessary spending."
- "Cancel Netflix to save money."
`;

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
