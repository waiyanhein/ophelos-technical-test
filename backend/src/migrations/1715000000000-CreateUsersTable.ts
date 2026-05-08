import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1715000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar(255) NOT NULL,
        "email" varchar(320) NOT NULL,
        "password" varchar(255) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query('CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email")');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "users_email_unique"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
