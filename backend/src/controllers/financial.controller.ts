import { Request, Response, Router } from 'express';
import { ZodError } from 'zod';
import { AppDataSource } from '../data-source';
import { requireAuth } from '../middleware/auth.middleware';
import { dashboardQuerySchema } from '../schemas/financial.schema';
import { getDashboard } from '../services/financial.service';
import { findStatementById, generateStatement } from '../services/financialStatement.service';
import {
  findSharableLinkByToken,
  generateSharableFinancialStatementLink,
  SharableLinkStatus,
} from '../services/sharableLink.service';

export const financialRouter = Router();
financialRouter.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
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
    handleError(res, error);
  }
});

financialRouter.post('/sharable-statement', requireAuth, async (req: Request, res: Response) => {
  const authUser = req.authUser;
  if (!authUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const { month, year } = dashboardQuerySchema.parse(req.body);
    const linkToken = await AppDataSource.transaction(async (manager) => {
      const statement = await generateStatement(manager, {
        userId: authUser.id,
        month: month === undefined ? undefined : Number(month),
        year: year === undefined ? undefined : Number(year),
      });
      return generateSharableFinancialStatementLink(manager, statement.id);
    });
    res.status(200).json({
      token: linkToken,
    });
  } catch (error) {
    handleError(res, error);
  }
});

financialRouter.get(`/sharable-statement`, async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token) {
      res.status(400).json({ error: 'Token is required' });
      return;
    }
    if (typeof token !== 'string') {
      res.status(400).json({ error: 'Token must be a string' });
      return;
    }
    const sharableLinkResult = await findSharableLinkByToken(token);
    const link = sharableLinkResult.record;
    if (!link) {
      res.status(404).json({ error: 'Sharable link not found' });
      return;
    }
    if (sharableLinkResult.status === SharableLinkStatus.EXPIRED) {
      res.status(404).json({ error: 'Sharable link has expired' });
      return;
    }
    const statement = await findStatementById(link.financialStatementId);
    if (!statement) {
      res.status(404).json({ error: 'Financial statement not found' });
      return;
    }
    res.status(200).json(statement);
  } catch (error) {
    handleError(res, error);
  }
});

const handleError = (res: Response, error: unknown) => {
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
};
