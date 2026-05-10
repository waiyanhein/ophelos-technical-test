import { Between, Repository } from 'typeorm';
import { UTCDate } from '@date-fns/utc';
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { AppDataSource } from '../data-source';
import { loadConfig } from '../config/env';
import { FinancialRecord } from '../entities/financial-record.entity';
import { getRecommendations } from './recommendations.service';

export type FinancialHealthColour = 'green' | 'amber' | 'red';
export type FinancialHealthRating = FinancialHealthColour;

export interface FinancialHealthSummary {
  rating: FinancialHealthRating;
  income: number;
  essentialSpend: number;
  debtRepayments: number;
  discretionarySpend: number;
  surplusAfterEssentials: number;
  headroom: number;
  headroomRatio: number;
  // What's truly left over after every outgoing this month — the "leftover"
  // figure surfaced in the financial-health widget. Mirrors the per-month
  // disposable-income calculation used by the over-time-progress widget so the
  // two widgets reconcile.
  disposableIncome: number;
}

export type FinancialHealthBadgeTone = 'success' | 'warning' | 'danger';

export interface FinancialHealthStatus extends FinancialHealthSummary {
  badgeLabel: string;
  badgeTone: FinancialHealthBadgeTone;
  headline: string;
  body: string;
}

export interface DiscretionaryItem {
  description: string;
  amount: number;
}

export type ProgressPoint = {
  period: string;
  progress: number;
  disposable_income: number;
  is_now: boolean;
};

export type OverTimeProgressOptions = {
  userId: string;
  month?: number;
  year?: number;
};

export type YourMoneyItem = {
  description: string;
  amount: number;
};

export type YourMoneySection = {
  sectionKey: string;
  sectionLabel: string;
  subtotal: number;
  items: YourMoneyItem[];
};

export type YourMoneyGroup = {
  total: number;
  sections: YourMoneySection[];
};

export type YourMoneyThisMonth = {
  income: YourMoneyGroup;
  outgoing: YourMoneyGroup;
};

export type YourMoneyThisMonthOptions = OverTimeProgressOptions;

export type Dashboard = {
  overTimeProgress: ProgressPoint[];
  yourMoneyThisMonth: YourMoneyThisMonth;
  financialHealthStatus: FinancialHealthStatus;
  recommendations: string[];
};

export type DashboardOptions = OverTimeProgressOptions;

type MonthBucket = {
  monthStart: UTCDate;
  totalIncome: number;
  totalExpenditure: number;
};

const getRepository = (): Repository<FinancialRecord> =>
  AppDataSource.getRepository(FinancialRecord);

const formatPeriod = (date: Date): string => format(date, 'MMM yyyy');

// Progress is a 0–100 score representing where a month sits within the
// disposable-income range of the current window: best month → 100, worst → 0.
// It is intentionally relative — it surfaces the customer's own trajectory
// rather than judging them against an absolute threshold.
export const calculateProgressForWindow = (disposableIncomes: number[]): number[] => {
  if (disposableIncomes.length === 0) {
    return [];
  }
  if (disposableIncomes.length === 1) {
    return [disposableIncomes[0] > 0 ? 100 : 0];
  }
  const min = Math.min(...disposableIncomes);
  const max = Math.max(...disposableIncomes);
  if (min === max) {
    return disposableIncomes.map(() => 50);
  }
  const range = max - min;
  return disposableIncomes.map((d) => Math.round(((d - min) / range) * 100));
};

const initBuckets = (mostRecentMonth: UTCDate, lookbackMonths: number): MonthBucket[] => {
  const oldestMonth = subMonths(mostRecentMonth, lookbackMonths - 1);
  return Array.from({ length: lookbackMonths }, (_, offset) => ({
    monthStart: addMonths(oldestMonth, offset),
    totalIncome: 0,
    totalExpenditure: 0,
  }));
};

const bucketKey = (date: Date): string => format(date, 'yyyy-MM');

export const getOverTimeProgress = async (
  options: OverTimeProgressOptions,
): Promise<ProgressPoint[]> => {
  const config = loadConfig();
  const lookbackMonths = config.progressLookbackMonths;
  const now = new UTCDate();
  const currentMonthStart = startOfMonth(now);

  let targetMonthStart = currentMonthStart;
  if (options.month && options.year) {
    targetMonthStart = startOfMonth(new UTCDate(options.year, options.month - 1, 1));
  }

  const buckets = initBuckets(targetMonthStart, lookbackMonths);

  const windowStart = buckets[0].monthStart;
  const windowEnd = endOfMonth(buckets[buckets.length - 1].monthStart);

  const records = await getRepository().find({
    where: {
      userId: options.userId,
      transactionDate: Between(windowStart, windowEnd),
    },
  });

  const bucketIndex = new Map<string, MonthBucket>();
  for (const bucket of buckets) {
    bucketIndex.set(bucketKey(bucket.monthStart), bucket);
  }

  for (const record of records) {
    const bucket = bucketIndex.get(bucketKey(new UTCDate(record.transactionDate)));
    if (!bucket) {
      continue;
    }
    const amount = Number(record.amount);
    if (record.type === 'income') {
      bucket.totalIncome += amount;
    } else {
      bucket.totalExpenditure += amount;
    }
  }

  // Buckets are built oldest → most recent for chronological aggregation;
  // the API returns them most recent → oldest so consumers can render the
  // newest period at the top of a list without re-sorting.
  const orderedBuckets = buckets.reverse();
  const disposableIncomes = orderedBuckets.map(
    (bucket) => bucket.totalIncome - bucket.totalExpenditure,
  );
  const progresses = calculateProgressForWindow(disposableIncomes);

  return orderedBuckets.map((bucket, index) => ({
    period: formatPeriod(bucket.monthStart),
    progress: progresses[index],
    disposable_income: disposableIncomes[index],
    is_now: isSameMonth(bucket.monthStart, currentMonthStart),
  }));
};

const INCOME_SECTION_KEY = 'income';
const INCOME_SECTION_LABEL = 'Income';
const UNCATEGORISED_SECTION_KEY = 'other';
const UNCATEGORISED_SECTION_LABEL = 'Other';

const round2 = (value: number): number => Math.round(value * 100) / 100;

// Convert kebab-case (the storage shape of `type_category`) to the two
// presentation forms the response needs. Doing it here means a future enum
// value lights up the whole response without touching this file.
const kebabToCamel = (value: string): string =>
  value
    .split('-')
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');

const kebabToTitle = (value: string): string =>
  value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const sectionKeyForRecord = (record: FinancialRecord): string => {
  if (record.type === 'income') return INCOME_SECTION_KEY;
  if (!record.typeCategory) return UNCATEGORISED_SECTION_KEY;
  return kebabToCamel(record.typeCategory);
};

const sectionLabelForRecord = (record: FinancialRecord): string => {
  if (record.type === 'income') return INCOME_SECTION_LABEL;
  if (!record.typeCategory) return UNCATEGORISED_SECTION_LABEL;
  return kebabToTitle(record.typeCategory);
};

export const getYourMoneyThisMonth = async (
  options: YourMoneyThisMonthOptions,
): Promise<YourMoneyThisMonth> => {
  const now = new UTCDate();
  const targetMonthStart =
    options.month && options.year
      ? startOfMonth(new UTCDate(options.year, options.month - 1, 1))
      : startOfMonth(now);
  const targetMonthEnd = endOfMonth(targetMonthStart);

  const records = await getRepository().find({
    where: {
      userId: options.userId,
      transactionDate: Between(targetMonthStart, targetMonthEnd),
    },
    order: { transactionDate: 'ASC', id: 'ASC' },
  });

  const buckets: Record<'income' | 'outgoing', Map<string, YourMoneySection>> = {
    income: new Map(),
    outgoing: new Map(),
  };
  const totals: Record<'income' | 'outgoing', number> = {
    income: 0,
    outgoing: 0,
  };

  for (const record of records) {
    const amount = Number(record.amount);
    totals[record.type] = round2(totals[record.type] + amount);

    const key = sectionKeyForRecord(record);
    let section = buckets[record.type].get(key);
    if (!section) {
      section = {
        sectionKey: key,
        sectionLabel: sectionLabelForRecord(record),
        subtotal: 0,
        items: [],
      };
      buckets[record.type].set(key, section);
    }
    section.subtotal = round2(section.subtotal + amount);

    // Aggregate items sharing a description so the widget shows one row per
    // recurring entry (e.g. two "Salary" records sum to a single "Salary" line).
    const existingItem = section.items.find((i) => i.description === record.description);
    if (existingItem) {
      existingItem.amount = round2(existingItem.amount + amount);
    } else {
      section.items.push({ description: record.description, amount });
    }
  }

  const buildGroup = (type: 'income' | 'outgoing'): YourMoneyGroup => {
    const sections = Array.from(buckets[type].values()).sort((a, b) =>
      a.sectionKey.localeCompare(b.sectionKey),
    );
    for (const section of sections) {
      // Largest amount first within a section; alphabetical tiebreaker keeps
      // the order deterministic across runs.
      section.items.sort((a, b) => {
        if (b.amount !== a.amount) return b.amount - a.amount;
        return a.description.localeCompare(b.description);
      });
    }
    return { total: totals[type], sections };
  };

  return {
    income: buildGroup('income'),
    outgoing: buildGroup('outgoing'),
  };
};

// Spec-defined thresholds for the headroom-ratio rating. Kept here (not in env)
// because changing them changes the meaning of the rating, not just a knob.
const HEADROOM_RATIO_AMBER_FLOOR = 0.1;
const HEADROOM_RATIO_GREEN_FLOOR = 0.2;

export interface HealthInputRecord {
  type: 'income' | 'outgoing';
  typeCategory: 'essential' | 'debt-repayment' | 'discretionary' | null;
  amount: number;
}

export const calculateFinancialHealth = (records: HealthInputRecord[]): FinancialHealthSummary => {
  let income = 0;
  let essentialSpend = 0;
  let debtRepayments = 0;
  let discretionarySpend = 0;

  for (const record of records) {
    const amount = Number(record.amount);
    if (record.type === 'income') {
      income += amount;
      continue;
    }
    if (record.typeCategory === 'essential') {
      essentialSpend += amount;
    } else if (record.typeCategory === 'debt-repayment') {
      debtRepayments += amount;
    } else {
      // Anything else outgoing — explicit "discretionary" or uncategorised — is
      // treated as discretionary. Uncategorised outgoings are negotiable by
      // default; if the user wants them protected they should categorise them.
      discretionarySpend += amount;
    }
  }

  const surplusAfterEssentials = income - essentialSpend;
  const headroom = surplusAfterEssentials - debtRepayments;
  const headroomRatio = income > 0 ? headroom / income : 0;

  let rating: FinancialHealthRating;
  if (income <= 0 || essentialSpend > income) {
    rating = 'red';
  } else if (headroom <= 0) {
    rating = 'red';
  } else if (headroomRatio < HEADROOM_RATIO_AMBER_FLOOR) {
    rating = 'red';
  } else if (headroomRatio < HEADROOM_RATIO_GREEN_FLOOR) {
    rating = 'amber';
  } else {
    rating = 'green';
  }

  const disposableIncome = income - essentialSpend - debtRepayments - discretionarySpend;

  return {
    rating,
    income: round2(income),
    essentialSpend: round2(essentialSpend),
    debtRepayments: round2(debtRepayments),
    discretionarySpend: round2(discretionarySpend),
    surplusAfterEssentials: round2(surplusAfterEssentials),
    headroom: round2(headroom),
    headroomRatio: Math.round(headroomRatio * 10000) / 10000,
    disposableIncome: round2(disposableIncome),
  };
};

// Rating-keyed copy lives on the backend so messaging stays consistent across
// surfaces and can be tweaked without a frontend deploy. Tone is included so
// the widget renders the same colour treatment everywhere.
const HEALTH_STATUS_COPY: Record<
  FinancialHealthRating,
  { badgeLabel: string; badgeTone: FinancialHealthBadgeTone; headline: string; body: string }
> = {
  red: {
    badgeLabel: 'Under pressure',
    badgeTone: 'danger',
    headline: 'Your essentials and debt repayments are stretching your income.',
    body: "You don't have meaningful breathing room this month. The suggestions below show where you might be able to free up some space — and a free debt adviser may be able to help you negotiate options.",
  },
  amber: {
    badgeLabel: 'Limited buffer',
    badgeTone: 'warning',
    headline: 'You are making progress, but most of your income is already committed.',
    body: 'There is limited room if something unexpected comes up. The suggestions below show where you might be able to free up some breathing room.',
  },
  green: {
    badgeLabel: 'On track',
    badgeTone: 'success',
    headline: 'You have a meaningful buffer each month.',
    body: 'You have room to absorb surprises and could redirect some of this surplus toward paying down debt sooner. Small optimisations are below.',
  },
};

export const buildFinancialHealthStatus = (
  summary: FinancialHealthSummary,
): FinancialHealthStatus => ({
  ...summary,
  ...HEALTH_STATUS_COPY[summary.rating],
});

export const extractDiscretionaryItems = (
  yourMoneyThisMonth: YourMoneyThisMonth,
): DiscretionaryItem[] => {
  const section = yourMoneyThisMonth.outgoing.sections.find(
    (s) => s.sectionKey === 'discretionary',
  );
  if (!section) return [];
  return section.items.map((item) => ({
    description: item.description,
    amount: item.amount,
  }));
};

const getRecordsForMonth = async (options: DashboardOptions): Promise<FinancialRecord[]> => {
  const now = new UTCDate();
  const targetMonthStart =
    options.month && options.year
      ? startOfMonth(new UTCDate(options.year, options.month - 1, 1))
      : startOfMonth(now);
  const targetMonthEnd = endOfMonth(targetMonthStart);

  return getRepository().find({
    where: {
      userId: options.userId,
      transactionDate: Between(targetMonthStart, targetMonthEnd),
    },
  });
};

export const getDashboard = async (options: DashboardOptions): Promise<Dashboard> => {
  const [overTimeProgress, yourMoneyThisMonth, monthRecords] = await Promise.all([
    getOverTimeProgress(options),
    getYourMoneyThisMonth(options),
    getRecordsForMonth(options),
  ]);

  const health = calculateFinancialHealth(
    monthRecords.map((r) => ({
      type: r.type,
      typeCategory: r.typeCategory,
      amount: Number(r.amount),
    })),
  );
  const discretionaryItems = extractDiscretionaryItems(yourMoneyThisMonth);
  const financialHealthStatus = buildFinancialHealthStatus(health);

  const recommendations = await getRecommendations({ health, discretionaryItems });

  return {
    overTimeProgress,
    yourMoneyThisMonth,
    financialHealthStatus,
    recommendations,
  };
};
