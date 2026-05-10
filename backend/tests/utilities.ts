import { AppDataSource } from '../src/data-source';
import timekeeper from 'timekeeper';

export const withDatabase = async () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    await AppDataSource.query(
      'TRUNCATE TABLE "financial_records", "users" RESTART IDENTITY CASCADE',
    );
  });
};

export const withMockDateAll = (date: Date) => {
  beforeAll(() => {
    timekeeper.freeze(date);
  });

  afterAll(() => {
    timekeeper.reset();
  });
};
