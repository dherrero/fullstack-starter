import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { Permission } from '@dto';
import {
  clearRefreshCookie,
  hasPermission,
  respondWithTokens,
} from './auth.middleware';
import { tokenService } from '@gateway/services';

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    method: 'GET',
    header: () => undefined,
    cookies: {},
    ...overrides,
  }) as unknown as Request;

const buildResponse = () => {
  const status = vi.fn();
  const json = vi.fn();
  const setHeader = vi.fn();
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  status.mockReturnValue({ json });
  return {
    res: {
      status,
      json,
      setHeader,
      cookie,
      clearCookie,
      locals: {},
    } as unknown as Response,
    status,
    json,
    setHeader,
    cookie,
    clearCookie,
  };
};

const FAMILY = 'family-uuid';

const mockFetchResponses = (
  responses: Array<{ status?: number; body?: unknown }>,
) => {
  const fetchMock = vi.fn();
  for (const r of responses) {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify(r.body ?? {}), {
          status: r.status ?? 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
  }
  globalThis.fetch = fetchMock as typeof fetch;
  return fetchMock;
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = 'gateway-access-secret';
  process.env.JWT_REFRESH_SECRET = 'gateway-refresh-secret';
  process.env.INTERNAL_JWT_SECRET = 'internal-secret';
  process.env.API_BASE_URL = 'http://api.test:3200';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '8h';
  process.env.NODE_ENV = 'development';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('hasPermission', () => {
  it('rejects requests without a refresh cookie', async () => {
    const middleware = hasPermission();
    const { res, status, json } = buildResponse();
    const next = vi.fn();

    await middleware(buildRequest(), res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a valid access token without contacting the api', async () => {
    const accessToken = await tokenService.generateAccessToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.ADMIN],
    });
    const refreshToken = await tokenService.generateRefreshToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.ADMIN],
    });

    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const req = buildRequest({
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? accessToken : undefined,
      cookies: { refreshToken },
    });
    const { res } = buildResponse();
    const next = vi.fn();

    await hasPermission(Permission.ADMIN)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.locals.user).toEqual(
      expect.objectContaining({ id: 7, email: 'a@b.com' }),
    );
  });

  it('rotates via the api when no access token is present', async () => {
    const refreshToken = await tokenService.generateRefreshToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.ADMIN],
    });

    const fetchMock = mockFetchResponses([
      {
        status: 200,
        body: {
          status: 'rotated',
          userId: 7,
          familyId: FAMILY,
          parentJti: 'old-jti',
        },
      },
      { status: 201, body: { recorded: true } },
    ]);

    const req = buildRequest({
      header: () => undefined,
      cookies: { refreshToken },
    });
    const { res, setHeader, cookie } = buildResponse();
    const next = vi.fn();

    await hasPermission()(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setHeader).toHaveBeenCalledWith('Authorization', expect.any(String));
    expect(cookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('clears the cookie and 401s when the api reports reuse', async () => {
    const refreshToken = await tokenService.generateRefreshToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.ADMIN],
    });

    mockFetchResponses([
      { status: 401, body: { error: 'Refresh chain reused-revoked' } },
    ]);

    const req = buildRequest({
      header: () => undefined,
      cookies: { refreshToken },
    });
    const { res, status, clearCookie } = buildResponse();
    const next = vi.fn();

    await hasPermission()(req, res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(401);
    expect(clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects when permissions do not match', async () => {
    const accessToken = await tokenService.generateAccessToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.READ_SOME_ENTITY],
    });
    const refreshToken = await tokenService.generateRefreshToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.READ_SOME_ENTITY],
    });

    const req = buildRequest({
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? accessToken : undefined,
      cookies: { refreshToken },
    });
    const { res, status } = buildResponse();
    const next = vi.fn();

    await hasPermission(Permission.ADMIN)(req, res, next as NextFunction);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('respondWithTokens', () => {
  it('records a fresh family on login and sets the cookie', async () => {
    mockFetchResponses([{ status: 201, body: { recorded: true } }]);
    const { res, setHeader, cookie } = buildResponse();

    await respondWithTokens(
      res,
      {
        id: 1,
        email: 'a@b.com',
        permissions: [Permission.ADMIN],
        remember: false,
      },
      { issueRefreshCookie: true, requestId: 'req-1' },
    );

    expect(setHeader).toHaveBeenCalledWith('Authorization', expect.any(String));
    expect(cookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });
});

describe('clearRefreshCookie', () => {
  it('clears the refresh cookie with matching options', () => {
    const { res, clearCookie } = buildResponse();
    clearRefreshCookie(res);
    expect(clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ httpOnly: true, path: '/' }),
    );
  });
});
