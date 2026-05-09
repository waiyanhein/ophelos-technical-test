import { Between, Repository } from 'typeorm';
import { UTCDate } from '@date-fns/utc';
import { addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { AppDataSource } from '../data-source';
import { loadConfig } from '../config/env';
import { FinancialRecord } from '../entities/financial-record.entity';

export type FinancialHealthColour = 'green' | 'amber' | 'red';

export interface ProgressPoint {
  period: string;
  progress: number;
  disposable_income: number;
  is_now: boolean;
}

export interface OverTimeProgressOptions {
  userId: string;
  month?: number;
}

export interface YourMoneyItem {
  description: string;
  amount: number;
}

export interface YourMoneySection {
  sectionKey: string;
  sectionLabel: string;
  subtotal: number;
  items: YourMoneyItem[];
}

export interface YourMoneyGroup {
  total: number;
  sections: YourMoneySection[];
}

export interface YourMoneyThisMonth {
  income: YourMoneyGroup;
  outgoing: YourMoneyGroup;
}

export type YourMoneyThisMonthOptions = OverTimeProgressOptions;

export interface Dashboard {
  overTimeProgress: ProgressPoint[];
  yourMoneyThisMonth: YourMoneyThisMonth;
}

export type DashboardOptions = OverTimeProgressOptions;

interface MonthBucket {
  monthStart: UTCDate;
  totalIncome: number;
  totalExpenditure: number;
}

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

export const colourForProgress = (progress: number): FinancialHealthColour => {
  if (progress >= 65) return 'green';
  if (progress >= 30) return 'amber';
  return 'red';
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

  const targetMonthStart =
    options.month !== undefined
      ? startOfMonth(new UTCDate(now.getUTCFullYear(), options.month - 1, 1))
      : currentMonthStart;

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
    options.month !== undefined
      ? startOfMonth(new UTCDate(now.getUTCFullYear(), options.month - 1, 1))
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

export const getDashboard = async (options: DashboardOptions): Promise<Dashboard> => {
  const [overTimeProgress, yourMoneyThisMonth] = await Promise.all([
    getOverTimeProgress(options),
    getYourMoneyThisMonth(options),
  ]);
  return { overTimeProgress, yourMoneyThisMonth };
};
