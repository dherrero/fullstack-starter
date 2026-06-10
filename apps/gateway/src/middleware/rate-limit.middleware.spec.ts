import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { loginRateLimiter } from './rate-limit.middleware';

const buildApp = () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  // Always "fail" so skipSuccessfulRequests does not exempt the attempts.
  app.post('/login', loginRateLimiter, (_req, res) => {
    res.status(401).json({ error: 'bad creds' });
  });
  return app;
};

describe('loginRateLimiter', () => {
  it('429s after too many failed attempts for the same ip+email', async () => {
    const app = buildApp();
    const agent = request(app);
    const body = { email: 'victim@example.com', password: 'x' };

    let last = 401;
    for (let i = 0; i < 12; i++) {
      const res = await agent.post('/login').send(body);
      last = res.status;
    }
    expect(last).toBe(429);
  });

  it('keys by email: a different account is not throttled by another’s failures', async () => {
    const app = buildApp();
    const agent = request(app);

    for (let i = 0; i < 12; i++) {
      await agent
        .post('/login')
        .send({ email: 'a@example.com', password: 'x' });
    }
    const other = await agent
      .post('/login')
      .send({ email: 'b@example.com', password: 'x' });
    expect(other.status).toBe(401);
  });
});
