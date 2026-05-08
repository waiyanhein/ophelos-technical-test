import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config/env';
import { AppDataSource } from '../../src/data-source';
import { User } from '../../src/entities/user.entity';

const PASSWORD = 'correct horse battery staple';

const createUser = async (
  overrides: Partial<Pick<User, 'name' | 'email' | 'password'>> = {},
): Promise<User> => {
  const repo = AppDataSource.getRepository(User);
  const user = repo.create({
    name: overrides.name ?? 'Ada Lovelace',
    email: overrides.email ?? 'ada@example.com',
    password:
      overrides.password ??
      (await bcrypt.hash(PASSWORD, 4)),
  });
  return repo.save(user);
};

describe('POST /auth/login (integration)', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
    await AppDataSource.runMigrations();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    await AppDataSource.query('TRUNCATE TABLE "users" RESTART IDENTITY CASCADE');
  });

  it('returns a signed JWT for valid credentials', async () => {
    const user = await createUser();

    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ authToken: expect.any(String) });

    const { jwtSecret } = loadConfig();
    const decoded = jwt.verify(response.body.authToken, jwtSecret) as {
      userId: string;
      email: string;
      iat: number;
      exp: number;
    };
    expect(decoded.userId).toBe(user.id);
    expect(decoded.email).toBe('ada@example.com');
    // 7 days = 604800 seconds
    expect(decoded.exp - decoded.iat).toBe(604800);
  });

  it('trims and lowercases the email before lookup', async () => {
    await createUser({ email: 'ada@example.com' });

    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: '  Ada@Example.COM  ', password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.body.authToken).toEqual(expect.any(String));
  });

  it('rejects requests with missing fields', async () => {
    const response = await request(createApp()).post('/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
    const fields = response.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
  });

  it('rejects malformed email', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'whatever' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('rejects non-string fields', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 123, password: { $ne: null } });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });

  it('returns 401 when the user does not exist', async () => {
    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid email or password' });
  });

  it('returns 401 when the password does not match', async () => {
    await createUser();

    const response = await request(createApp())
      .post('/auth/login')
      .send({ email: 'ada@example.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid email or password' });
  });
});
