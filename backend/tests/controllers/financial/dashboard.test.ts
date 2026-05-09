import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { loadConfig } from '../../../src/config/env';
import { withDatabase } from '../../utilities';
import { createUser, tokenForUser } from './helpers';

describe('GET /financial/dashboard — shared concerns (integration)', () => {
  withDatabase();

  describe('authentication', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      const response = await request(createApp()).get('/financial/dashboard');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Missing or malformed authorization header',
      });
    });

    it('returns 401 when the Authorization header is malformed', async () => {
      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', 'NotBearer abc');
      expect(response.status).toBe(401);
    });

    it('returns 401 when the JWT signature is invalid', async () => {
      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid token' });
    });

    it('returns 401 when the JWT has expired', async () => {
      const user = await createUser();
      const { jwtSecret } = loadConfig();
      const expired = jwt.sign({ userId: user.id, email: user.email }, jwtSecret, {
        expiresIn: '-1s',
      });
      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', `Bearer ${expired}`);
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Token has expired' });
    });
  });

  describe('query parameter validation', () => {
    it('rejects a non-2-digit month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=3')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('ValidationError');
    });

    it('rejects an out-of-range month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=13')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });

    it('rejects a non-numeric month', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard?month=ab')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
    });
  });

  describe('top-level response shape', () => {
    it('returns 200 with both widget fields populated', async () => {
      const user = await createUser();
      const token = tokenForUser(user);

      const response = await request(createApp())
        .get('/financial/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.overTimeProgress)).toBe(true);
      expect(response.body.yourMoneyThisMonth).toEqual({
        income: { total: 0, sections: [] },
        outgoing: { total: 0, sections: [] },
      });
    });
  });
});
