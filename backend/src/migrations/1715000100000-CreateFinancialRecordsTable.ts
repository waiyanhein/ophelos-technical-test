import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFinancialRecordsTable1715000100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "financial_records_type_enum" AS ENUM ('income', 'outgoing')
    `);

    await queryRunner.query(`
      CREATE TYPE "financial_records_type_category_enum"
        AS ENUM ('debt-repayment', 'discretionary', 'essential')
    `);

    await queryRunner.query(`
      CREATE TABLE "financial_records" (
        "id" SERIAL PRIMARY KEY,
        "amount" numeric(14, 2) NOT NULL,
        "type" "financial_records_type_enum" NOT NULL,
        "type_category" "financial_records_type_category_enum",
        "description" varchar(255) NOT NULL,
        "transaction_date" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        CONSTRAINT "financial_records_user_id_fkey"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "financial_records_user_id_idx" ON "financial_records" ("user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "financial_records_transaction_date_idx" ON "financial_records" ("transaction_date")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "financial_records_transaction_date_idx"');
    await queryRunner.query('DROP INDEX IF EXISTS "financial_records_user_id_idx"');
    await queryRunner.query('DROP TABLE IF EXISTS "financial_records"');
    await queryRunner.query('DROP TYPE IF EXISTS "financial_records_type_category_enum"');
    await queryRunner.query('DROP TYPE IF EXISTS "financial_records_type_enum"');
  }
}
