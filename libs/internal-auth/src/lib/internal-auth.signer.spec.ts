import { generateKeyPairSync } from 'crypto';
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

const buildEd25519KeyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKey: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  };
};

const { privateKey, publicKey } = buildEd25519KeyPair();

describe('signUserContext / verifyInternalAuth', () => {
  it('round-trips a user context signed with EdDSA', async () => {
    const token = await signUserContext(
      {
        userId: 42,
        permissions: [Permission.ADMIN],
        requestId: 'req-1',
      },
      { privateKey },
    );
    const claims = await verifyInternalAuth(token, { publicKey });

    expect(claims.sub).toBe(42);
    expect(claims.scope).toBe(InternalScope.USER_REQUEST);
    expect(claims.permissions).toEqual([Permission.ADMIN]);
    expect(claims.requestId).toBe('req-1');
    expect(claims.iss).toBe(INTERNAL_AUTH_ISSUER);
    expect(claims.aud).toBe(INTERNAL_AUTH_AUDIENCE_API);
  });

  it('generates a requestId when none is provided', async () => {
    const token = await signUserContext(
      { userId: 1, permissions: [] },
      { privateKey },
    );
    const claims = await verifyInternalAuth(token, { publicKey });
    expect(claims.requestId).toBeDefined();
    expect(claims.requestId.length).toBeGreaterThan(0);
  });

  it('cannot be verified with a different public key', async () => {
    const token = await signUserContext(
      { userId: 1, permissions: [] },
      { privateKey },
    );
    const other = buildEd25519KeyPair();
    await expect(
      verifyInternalAuth(token, { publicKey: other.publicKey }),
    ).rejects.toThrow();
  });

  it('rejects expired tokens', async () => {
    const token = await signUserContext(
      { userId: 1, permissions: [] },
      { privateKey, ttlSeconds: 1 },
    );
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await expect(verifyInternalAuth(token, { publicKey })).rejects.toThrow();
  });

  it('rejects mismatched audience', async () => {
    const token = await signUserContext(
      { userId: 1, permissions: [] },
      { privateKey, audience: 'other-service' },
    );
    await expect(
      verifyInternalAuth(token, {
        publicKey,
        audience: INTERNAL_AUTH_AUDIENCE_API,
      }),
    ).rejects.toThrow();
  });

  it('throws when the private key is empty', async () => {
    await expect(
      signUserContext({ userId: 1, permissions: [] }, { privateKey: '' }),
    ).rejects.toThrow('INTERNAL_JWT_PRIVATE_KEY');
  });

  it('normalises PEM keys with literal \\n escapes', async () => {
    const escapedPrivate = privateKey.replace(/\n/g, '\\n');
    const escapedPublic = publicKey.replace(/\n/g, '\\n');

    const token = await signUserContext(
      { userId: 5, permissions: [] },
      { privateKey: escapedPrivate },
    );
    const claims = await verifyInternalAuth(token, {
      publicKey: escapedPublic,
    });
    expect(claims.sub).toBe(5);
  });
});

describe('signSystemContext', () => {
  it('round-trips a system context for auth.validate', async () => {
    const token = await signSystemContext(
      { scope: InternalScope.AUTH_VALIDATE, requestId: 'sys-1' },
      { privateKey },
    );
    const claims = await verifyInternalAuth(token, { publicKey });
    expect(claims.sub).toBe(INTERNAL_SYSTEM_SUBJECT);
    expect(claims.scope).toBe(InternalScope.AUTH_VALIDATE);
    expect(claims.permissions).toEqual([]);
    expect(claims.requestId).toBe('sys-1');
  });

  it('round-trips a system context for refresh.lifecycle', async () => {
    const token = await signSystemContext(
      { scope: InternalScope.REFRESH_LIFECYCLE },
      { privateKey },
    );
    const claims = await verifyInternalAuth(token, { publicKey });
    expect(claims.scope).toBe(InternalScope.REFRESH_LIFECYCLE);
  });
});

describe('privilege separation', () => {
  it('downstream services that only have a public key cannot mint tokens', async () => {
    await expect(
      signUserContext(
        { userId: 1, permissions: [] },
        { privateKey: publicKey },
      ),
    ).rejects.toThrow();
  });
});
