import { AppDataSource } from '../src/data-source';

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
