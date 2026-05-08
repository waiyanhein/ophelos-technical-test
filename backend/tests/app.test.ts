import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /', () => {
  it('returns hello world', async () => {
    const app = createApp();

    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'hello world' });
  });
});
