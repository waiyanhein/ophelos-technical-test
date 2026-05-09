import 'reflect-metadata';
import bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { User } from '../entities/user.entity';

const SEED_USER = {
  name: 'Wai Hein',
  email: 'waiyanhein@test.com',
  password: 'Test123!',
};

const BCRYPT_ROUNDS = 10;

const seed = async (): Promise<void> => {
  await AppDataSource.initialize();

  try {
    const repo = AppDataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email: SEED_USER.email } });

    if (existing) {
      console.log(`User "${SEED_USER.email}" already exists — skipping.`);
      return;
    }

    const passwordHash = await bcrypt.hash(SEED_USER.password, BCRYPT_ROUNDS);
    await repo.insert({
      name: SEED_USER.name,
      email: SEED_USER.email,
      password: passwordHash,
    });

    console.log(`Created user "${SEED_USER.email}".`);
  } finally {
    await AppDataSource.destroy();
  }
};

seed().catch((error: unknown) => {
  console.error('Seeding failed', error);
  process.exit(1);
});
