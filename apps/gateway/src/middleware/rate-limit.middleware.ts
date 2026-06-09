import HttpResponser from '@gateway/adapters/http/http.responser';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const num = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const tooManyRequests = (_req: Request, res: Response) =>
  HttpResponser.errorJson(
    res,
    { message: 'Too many attempts, please try again later.' },
    429,
  );

/**
 * Anti brute-force / credential-stuffing limiter for the login endpoint.
 * Keyed by IP + submitted email so one attacker cannot lock every account by
 * cycling addresses, nor exhaust one account from many IPs unnoticed. Only
 * failed attempts count (skipSuccessfulRequests) so normal logins are never
 * throttled. `trust proxy: 1` is set in main.ts, so req.ip is the real client.
 */
export const loginRateLimiter = rateLimit({
  windowMs: num(process.env.LOGIN_RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.LOGIN_RATE_MAX, 10),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // IP comes from req.ip (trust proxy: 1 → real client behind Nginx).
  validate: { keyGeneratorIpFallback: false },
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : 'unknown';
    return `${req.ip ?? 'unknown-ip'}:${email}`;
  },
  handler: tooManyRequests,
});

/**
 * Coarser per-IP limiter for the rest of the auth surface (logout, refresh
 * rotation that flows through the proxy) to blunt automated abuse without
 * impacting interactive use.
 */
export const authRateLimiter = rateLimit({
  windowMs: num(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  limit: num(process.env.AUTH_RATE_MAX, 100),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooManyRequests,
});
