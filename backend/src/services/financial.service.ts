import { Between, Repository } from 'typeorm';
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
  now?: Date;
  lookbackMonths?: number;
}

export interface Dashboard {
  overTimeProgress: ProgressPoint[];
}

export type DashboardOptions = OverTimeProgressOptions;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface MonthBucket {
  year: number;
  monthIndex: number;
  totalIncome: number;
  totalExpenditure: number;
}

const getRepository = (): Repository<FinancialRecord> =>
  AppDataSource.getRepository(FinancialRecord);

const formatPeriod = (year: number, monthIndex: number): string =>
  `${MONTH_NAMES[monthIndex]} ${year}`;

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

const buildBuckets = (
  mostRecentYear: number,
  mostRecentMonth: number,
  lookbackMonths: number,
): MonthBucket[] => {
  const buckets: MonthBucket[] = [];
  for (let offset = lookbackMonths - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(mostRecentYear, mostRecentMonth - 1 - offset, 1));
    buckets.push({
      year: date.getUTCFullYear(),
      monthIndex: date.getUTCMonth(),
      totalIncome: 0,
      totalExpenditure: 0,
    });
  }
  return buckets;
};

const bucketKey = (year: number, monthIndex: number): string => `${year}-${monthIndex}`;

export const getOverTimeProgress = async (
  options: OverTimeProgressOptions,
): Promise<ProgressPoint[]> => {
  const config = loadConfig();
  const lookbackMonths = options.lookbackMonths ?? config.progressLookbackMonths;
  const now = options.now ?? new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const targetYear = currentYear;
  const targetMonth = options.month ?? currentMonth;

  const buckets = buildBuckets(targetYear, targetMonth, lookbackMonths);

  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];
  const windowStart = new Date(Date.UTC(firstBucket.year, firstBucket.monthIndex, 1, 0, 0, 0, 0));
  const windowEndExclusive = new Date(
    Date.UTC(lastBucket.year, lastBucket.monthIndex + 1, 1, 0, 0, 0, 0),
  );
  const windowEnd = new Date(windowEndExclusive.getTime() - 1);

  const records = await getRepository().find({
    where: {
      userId: options.userId,
      transactionDate: Between(windowStart, windowEnd),
    },
  });

  const bucketIndex = new Map<string, MonthBucket>();
  for (const bucket of buckets) {
    bucketIndex.set(bucketKey(bucket.year, bucket.monthIndex), bucket);
  }

  for (const record of records) {
    const transactionDate = new Date(record.transactionDate);
    const key = bucketKey(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth());
    const bucket = bucketIndex.get(key);
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
    period: formatPeriod(bucket.year, bucket.monthIndex),
    progress: progresses[index],
    disposable_income: disposableIncomes[index],
    is_now: bucket.year === currentYear && bucket.monthIndex === currentMonth - 1,
  }));
};

export const getDashboard = async (options: DashboardOptions): Promise<Dashboard> => {
  const overTimeProgress = await getOverTimeProgress(options);
  return { overTimeProgress };
};
