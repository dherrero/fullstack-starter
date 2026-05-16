import { randomUUID } from 'crypto';
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from 'jose';

import type { Permission } from '@dto';
import {
  INTERNAL_AUTH_AUDIENCE_API,
  INTERNAL_AUTH_DEFAULT_TTL_SECONDS,
  INTERNAL_AUTH_ISSUER,
  INTERNAL_SYSTEM_SUBJECT,
  InternalScope,
} from './internal-auth.constants';
import type {
  InternalAuthClaims,
  InternalAuthSignOptions,
  InternalAuthVerifyOptions,
} from './internal-auth.types';

interface SignUserContextInput {
  userId: string | number;
  permissions: Permission[];
  requestId?: string;
}

interface SignSystemContextInput {
  scope: InternalScope;
  requestId?: string;
}

const ALG = 'EdDSA';

/**
 * Normalise PEM-encoded keys that arrive through env vars: docker/.env
 * style files commonly carry `\n` as a literal escape sequence; convert
 * those to real newlines so jose accepts the key.
 */
const normalisePem = (pem: string): string => pem.replace(/\\n/g, '\n');

/**
 * Issue an internal JWT representing a fully-authenticated end-user
 * forwarded by the gateway. Signed with EdDSA (Ed25519) so downstream
 * services only need the matching public key to verify, and cannot
 * forge new tokens.
 */
export const signUserContext = (
  input: SignUserContextInput,
  options: InternalAuthSignOptions,
): Promise<string> =>
  signClaims(
    {
      sub: input.userId,
      scope: InternalScope.USER_REQUEST,
      permissions: input.permissions,
      requestId: input.requestId ?? randomUUID(),
    },
    options,
  );

/**
 * Issue an internal JWT representing the gateway itself acting without
 * a user (system-to-system calls like /internal/auth/validate).
 */
export const signSystemContext = (
  input: SignSystemContextInput,
  options: InternalAuthSignOptions,
): Promise<string> =>
  signClaims(
    {
      sub: INTERNAL_SYSTEM_SUBJECT,
      scope: input.scope,
      permissions: [],
      requestId: input.requestId ?? randomUUID(),
    },
    options,
  );

const signClaims = async (
  claims: Pick<
    InternalAuthClaims,
    'sub' | 'scope' | 'permissions' | 'requestId'
  >,
  options: InternalAuthSignOptions,
): Promise<string> => {
  if (!options.privateKey) {
    throw new Error('INTERNAL_JWT_PRIVATE_KEY is not configured');
  }
  const key = await importPKCS8(normalisePem(options.privateKey), ALG);
  const ttl = options.ttlSeconds ?? INTERNAL_AUTH_DEFAULT_TTL_SECONDS;
  return new SignJWT({
    scope: claims.scope,
    permissions: claims.permissions,
    requestId: claims.requestId,
  })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(options.issuer ?? INTERNAL_AUTH_ISSUER)
    .setAudience(options.audience ?? INTERNAL_AUTH_AUDIENCE_API)
    .setSubject(String(claims.sub))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(key);
};

export const verifyInternalAuth = async (
  token: string,
  options: InternalAuthVerifyOptions,
): Promise<InternalAuthClaims> => {
  if (!options.publicKey) {
    throw new Error('INTERNAL_JWT_PUBLIC_KEY is not configured');
  }
  const key = await importSPKI(normalisePem(options.publicKey), ALG);
  const { payload } = await jwtVerify(token, key, {
    issuer: options.issuer ?? INTERNAL_AUTH_ISSUER,
    audience: options.audience ?? INTERNAL_AUTH_AUDIENCE_API,
    algorithms: [ALG],
  });

  const subRaw = payload.sub ?? '';
  const subNumeric = Number(subRaw);
  const sub: string | number =
    Number.isFinite(subNumeric) && subRaw !== '' ? subNumeric : subRaw;

  return {
    sub,
    scope: payload['scope'] as InternalScope,
    permissions: (payload['permissions'] ?? []) as Permission[],
    requestId: payload['requestId'] as string,
    iss: payload.iss,
    aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
    iat: payload.iat,
    exp: payload.exp,
  };
};
