import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Repository } from 'typeorm';
import { AppDataSource } from '../data-source';
import { User } from '../entities/user.entity';
import { loadConfig } from '../config/env';
import { LoginInput } from '../schemas/auth.schema';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

const TOKEN_EXPIRY: SignOptions['expiresIn'] = '7d';

const getUserRepository = (): Repository<User> => AppDataSource.getRepository(User);

export const login = async (input: LoginInput): Promise<{ authToken: string }> => {
  const repo = getUserRepository();
  const user = await repo.findOne({ where: { email: input.email } });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(input.password, user.password);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  const { jwtSecret } = loadConfig();
  const authToken = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, {
    expiresIn: TOKEN_EXPIRY,
  });

  return { authToken };
};
