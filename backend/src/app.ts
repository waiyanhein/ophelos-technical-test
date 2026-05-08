import express, { Express, Request, Response } from 'express';
import { authRouter } from './controllers/auth.controller';

export const createApp = (): Express => {
  const app = express();

  app.use(express.json());

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'hello world' });
  });

  app.use('/auth', authRouter);

  return app;
};
