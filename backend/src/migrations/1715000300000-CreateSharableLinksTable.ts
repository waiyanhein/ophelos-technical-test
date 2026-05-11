import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSharableLinksTable1715000300000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "sharable_links" (
        "id" SERIAL PRIMARY KEY,
        "financial_statement_id" integer NOT NULL,
        "token" varchar(255) NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "sharable_links_financial_statement_id_fkey"
          FOREIGN KEY ("financial_statement_id") REFERENCES "financial_statements"("id") ON DELETE CASCADE,
        CONSTRAINT "sharable_links_token_unique" UNIQUE ("token")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "sharable_links_financial_statement_id_idx" ON "sharable_links" ("financial_statement_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "sharable_links_financial_statement_id_idx"');
    await queryRunner.query('DROP TABLE IF EXISTS "sharable_links"');
  }
}
