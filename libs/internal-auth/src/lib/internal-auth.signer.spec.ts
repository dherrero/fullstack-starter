import { describe, expect, it } from 'vitest';
import { Permission } from '@dto';
import {
  INTERNAL_AUTH_AUDIENCE_API,
  INTERNAL_AUTH_ISSUER,
  INTERNAL_SYSTEM_SUBJECT,
  InternalScope,
} from './internal-auth.constants';
import {
  signSystemContext,
  signUserContext,
  verifyInternalAuth,
} from './internal-auth.signer';

const SECRET = 'internal-test-secret';

describe('signUserContext / verifyInternalAuth', () => {
  it('signs and verifies a user context with permissions', () => {
    const token = signUserContext(
      {
        userId: 42,
        permissions: [Permission.ADMIN],
        requestId: 'req-1',
      },
      { secret: SECRET },
    );

    const claims = verifyInternalAuth(token, { secret: SECRET });

    expect(claims.sub).toBe(42);
    expect(claims.scope).toBe(InternalScope.USER_REQUEST);
    expect(claims.permissions).toEqual([Permission.ADMIN]);
    expect(claims.requestId).toBe('req-1');
    expect(claims.iss).toBe(INTERNAL_AUTH_ISSUER);
    expect(claims.aud).toBe(INTERNAL_AUTH_AUDIENCE_API);
  });

  it('generates a requestId when none is provided', () => {
    const token = signUserContext(
      { userId: 1, permissions: [] },
      { secret: SECRET },
    );
    const claims = verifyInternalAuth(token, { secret: SECRET });

    expect(claims.requestId).toBeDefined();
    expect(claims.requestId.length).toBeGreaterThan(0);
  });

  it('rejects tokens signed with a different secret', () => {
    const token = signUserContext(
      { userId: 1, permissions: [] },
      { secret: SECRET },
    );

    expect(() =>
      verifyInternalAuth(token, { secret: 'wrong-secret' }),
    ).toThrow();
  });

  it('rejects tokens past their expiration', async () => {
    const token = signUserContext(
      { userId: 1, permissions: [] },
      { secret: SECRET, ttlSeconds: 1 },
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(() => verifyInternalAuth(token, { secret: SECRET })).toThrow();
  });

  it('rejects tokens with a different audience', () => {
    const token = signUserContext(
      { userId: 1, permissions: [] },
      { secret: SECRET, audience: 'other-service' },
    );

    expect(() =>
      verifyInternalAuth(token, {
        secret: SECRET,
        audience: INTERNAL_AUTH_AUDIENCE_API,
      }),
    ).toThrow();
  });

  it('throws when the secret is missing', () => {
    expect(() =>
      signUserContext({ userId: 1, permissions: [] }, { secret: '' }),
    ).toThrow('INTERNAL_JWT_SECRET');
  });
});

describe('signSystemContext', () => {
  it('signs and verifies a system context for auth.validate', () => {
    const token = signSystemContext(
      { scope: InternalScope.AUTH_VALIDATE, requestId: 'sys-1' },
      { secret: SECRET },
    );

    const claims = verifyInternalAuth(token, { secret: SECRET });

    expect(claims.sub).toBe(INTERNAL_SYSTEM_SUBJECT);
    expect(claims.scope).toBe(InternalScope.AUTH_VALIDATE);
    expect(claims.permissions).toEqual([]);
    expect(claims.requestId).toBe('sys-1');
  });
});
