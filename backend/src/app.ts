import express, { Express, Request, Response } from 'express';

export const createApp = (): Express => {
  const app = express();

  app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'hello world' });
  });

  return app;
};
