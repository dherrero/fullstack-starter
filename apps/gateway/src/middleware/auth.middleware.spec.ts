import { beforeEach, describe, expect, it, vi } from 'vitest';
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

beforeEach(() => {
  process.env.JWT_ACCESS_SECRET = 'gateway-access-secret';
  process.env.JWT_REFRESH_SECRET = 'gateway-refresh-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.JWT_REFRESH_EXPIRES_IN = '8h';
  process.env.NODE_ENV = 'development';
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

  it('accepts a valid access token and exposes the user context', async () => {
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

    const req = buildRequest({
      header: (name: string) =>
        name.toLowerCase() === 'authorization' ? accessToken : undefined,
      cookies: { refreshToken },
    });
    const { res } = buildResponse();
    const next = vi.fn();

    await hasPermission(Permission.ADMIN)(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.locals.user).toEqual(
      expect.objectContaining({
        id: 7,
        email: 'a@b.com',
        permissions: [Permission.ADMIN],
      }),
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

  it('rotates the access token from the refresh cookie when missing', async () => {
    const refreshToken = await tokenService.generateRefreshToken({
      id: 7,
      email: 'a@b.com',
      permissions: [Permission.ADMIN],
    });

    const req = buildRequest({
      header: () => undefined,
      cookies: { refreshToken },
    });
    const { res, setHeader } = buildResponse();
    const next = vi.fn();

    await hasPermission()(req, res, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('Authorization', expect.any(String));
  });
});

describe('respondWithTokens', () => {
  it('issues access header and refresh cookie when requested', async () => {
    const { res, setHeader, cookie } = buildResponse();
    await respondWithTokens(
      res,
      {
        id: 1,
        email: 'a@b.com',
        permissions: [Permission.ADMIN],
        remember: false,
      },
      { issueRefreshCookie: true },
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
