import { NextFunction, Request, Response } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { loadConfig } from '../config/env';

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthenticatedRequestUser;
  }
}

interface JwtPayload {
  userId: string;
  email: string;
}

const isJwtPayload = (value: unknown): value is JwtPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record: Record<string, unknown> = { ...value };
  return typeof record.userId === 'string' && typeof record.email === 'string';
};

const extractBearerToken = (header: string | undefined): string | null => {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token.trim();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    res.status(401).json({ error: 'Missing or malformed authorization header' });
    return;
  }

  try {
    const { jwtSecret } = loadConfig();
    const decoded = jwt.verify(token, jwtSecret);

    if (!isJwtPayload(decoded)) {
      res.status(401).json({ error: 'Invalid token payload' });
      return;
    }

    req.authUser = { id: decoded.userId, email: decoded.email };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({ error: 'Token has expired' });
      return;
    }
    if (error instanceof JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    next(error);
  }
};
