import { Request, Response, Router } from 'express';
import { ZodError } from 'zod';
import { loginSchema } from '../schemas/auth.schema';
import { InvalidCredentialsError, login } from '../services/auth.service';

export const authRouter = Router();

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await login(input);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'ValidationError',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    console.error('Login failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
