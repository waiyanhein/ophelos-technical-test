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

export interface Dashboard {
  overTimeProgress: ProgressPoint[];
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

export const getDashboard = async (options: DashboardOptions): Promise<Dashboard> => {
  const overTimeProgress = await getOverTimeProgress(options);
  return { overTimeProgress };
};
