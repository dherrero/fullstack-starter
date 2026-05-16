import { generateKeyPairSync } from 'crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { Permission } from '@dto';
import {
  INTERNAL_AUTH_HEADER,
  INTERNAL_REQUEST_ID_HEADER,
  InternalScope,
} from './internal-auth.constants';
import { requireInternalAuth } from './internal-auth.middleware';
import { signSystemContext, signUserContext } from './internal-auth.signer';

const buildEd25519KeyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  };
};

const { privateKey, publicKey } = buildEd25519KeyPair();

const buildResponse = () => {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const locals: Record<string, unknown> = {};
  return {
    res: { status, setHeader, locals } as unknown as Response,
    status,
    json,
    setHeader,
    locals,
  };
};

const buildRequest = (token?: string): Request =>
  ({
    header: (name: string) =>
      name.toLowerCase() === INTERNAL_AUTH_HEADER ? token : undefined,
  }) as unknown as Request;

describe('requireInternalAuth', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('rejects requests without the internal header', async () => {
    const middleware = requireInternalAuth({ publicKey });
    const { res, status, json } = buildResponse();

    await middleware(buildRequest(), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_AUTH_MISSING' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects requests with an invalid token', async () => {
    const middleware = requireInternalAuth({ publicKey });
    const { res, status, json } = buildResponse();

    await middleware(buildRequest('not-a-jwt'), res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_AUTH_INVALID' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('lets a valid user-scope token through and exposes claims', async () => {
    const token = await signUserContext(
      {
        userId: 9,
        permissions: [Permission.ADMIN],
        requestId: 'req-9',
      },
      { privateKey },
    );
    const middleware = requireInternalAuth({
      publicKey,
      allowedScopes: [InternalScope.USER_REQUEST],
      requiredPermissions: [Permission.ADMIN],
    });
    const { res, locals, setHeader } = buildResponse();

    await middleware(buildRequest(token), res, next);

    expect(next).toHaveBeenCalled();
    expect(locals['internalAuth']).toEqual(
      expect.objectContaining({
        sub: 9,
        permissions: [Permission.ADMIN],
        scope: InternalScope.USER_REQUEST,
        requestId: 'req-9',
      }),
    );
    expect(setHeader).toHaveBeenCalledWith(INTERNAL_REQUEST_ID_HEADER, 'req-9');
  });

  it('rejects a system token where only user scope is allowed', async () => {
    const token = await signSystemContext(
      { scope: InternalScope.AUTH_VALIDATE },
      { privateKey },
    );
    const middleware = requireInternalAuth({
      publicKey,
      allowedScopes: [InternalScope.USER_REQUEST],
    });
    const { res, status, json } = buildResponse();

    await middleware(buildRequest(token), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_AUTH_SCOPE_DENIED' }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when required permissions are not satisfied', async () => {
    const token = await signUserContext(
      {
        userId: 1,
        permissions: [Permission.READ_SOME_ENTITY],
      },
      { privateKey },
    );
    const middleware = requireInternalAuth({
      publicKey,
      requiredPermissions: [Permission.ADMIN],
    });
    const { res, status, json } = buildResponse();

    await middleware(buildRequest(token), res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INTERNAL_AUTH_PERMISSION_DENIED' }),
    );
  });
});
