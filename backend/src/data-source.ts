import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { loadConfig } from './config/env';

export const buildDataSourceOptions = (): DataSourceOptions => {
  const { database, nodeEnv } = loadConfig();

  return {
    type: 'postgres',
    host: database.host,
    port: database.port,
    username: database.username,
    password: database.password,
    database: database.database,
    synchronize: false,
    logging: nodeEnv === 'development',
    entities: [__dirname + '/entities/**/*.{ts,js}'],
    migrations: [__dirname + '/migrations/**/*.{ts,js}'],
  };
};

export const AppDataSource = new DataSource(buildDataSourceOptions());
