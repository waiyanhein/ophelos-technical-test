import { Request, Response, Router } from 'express';
import { ZodError } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { dashboardQuerySchema } from '../schemas/financial.schema';
import { getDashboard } from '../services/financial.service';

export const financialRouter = Router();

financialRouter.use(requireAuth);

financialRouter.get('/dashboard', async (req: Request, res: Response) => {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { month, year } = dashboardQuerySchema.parse(req.query);
    const result = await getDashboard({
      userId: authUser.id,
      month: month === undefined ? undefined : Number(month),
      year: year === undefined ? undefined : Number(year),
    });
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

    console.error('Failed to compute financial dashboard', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
