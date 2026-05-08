import 'dotenv/config';

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const optionalNumber = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number, got: ${raw}`);
  }
  return parsed;
};

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  jwtSecret: string;
  database: DatabaseConfig;
}

const buildConfig = (): AppConfig => ({
  port: optionalNumber('PORT', 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  jwtSecret: requireEnv('JWT_SECRET'),
  database: {
    host: requireEnv('DB_HOST'),
    port: optionalNumber('DB_PORT', 5432),
    username: requireEnv('DB_USERNAME'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_NAME'),
  },
});

let cached: AppConfig | undefined;

export const loadConfig = (): AppConfig => (cached ??= buildConfig());

export const resetConfigForTests = (): void => {
  cached = undefined;
};
