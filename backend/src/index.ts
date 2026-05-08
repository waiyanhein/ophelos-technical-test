import 'reflect-metadata';
import { createApp } from './app';
import { loadConfig } from './config/env';
import { AppDataSource } from './data-source';

const bootstrap = async (): Promise<void> => {
  const { port } = loadConfig();

  await AppDataSource.initialize();
  console.log('Database connection established');

  const app = createApp();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

bootstrap().catch((error: unknown) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
