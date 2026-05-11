import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinancialStatementsTable1715000200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "financial_statements" (
        "id" SERIAL PRIMARY KEY,
        "user_id" uuid NOT NULL,
        "data" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "financial_statements_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "financial_statements_user_id_idx" ON "financial_statements" ("user_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "financial_statements_user_id_idx"');
    await queryRunner.query('DROP TABLE IF EXISTS "financial_statements"');
  }
}
