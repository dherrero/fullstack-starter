import { randomUUID } from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';

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

/**
 * Issue an internal JWT representing a fully-authenticated end-user
 * forwarded by the gateway. Uses HS256 with the shared internal secret.
 */
export const signUserContext = (
  input: SignUserContextInput,
  options: InternalAuthSignOptions,
): string =>
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
 * a user (for system-to-system calls like /internal/auth/validate).
 */
export const signSystemContext = (
  input: SignSystemContextInput,
  options: InternalAuthSignOptions,
): string =>
  signClaims(
    {
      sub: INTERNAL_SYSTEM_SUBJECT,
      scope: input.scope,
      permissions: [],
      requestId: input.requestId ?? randomUUID(),
    },
    options,
  );

const signClaims = (
  claims: Pick<
    InternalAuthClaims,
    'sub' | 'scope' | 'permissions' | 'requestId'
  >,
  options: InternalAuthSignOptions,
): string => {
  if (!options.secret) {
    throw new Error('INTERNAL_JWT_SECRET is not configured');
  }
  return jwt.sign(claims, options.secret, {
    algorithm: 'HS256',
    issuer: options.issuer ?? INTERNAL_AUTH_ISSUER,
    audience: options.audience ?? INTERNAL_AUTH_AUDIENCE_API,
    expiresIn: options.ttlSeconds ?? INTERNAL_AUTH_DEFAULT_TTL_SECONDS,
  });
};

export const verifyInternalAuth = (
  token: string,
  options: InternalAuthVerifyOptions,
): InternalAuthClaims => {
  if (!options.secret) {
    throw new Error('INTERNAL_JWT_SECRET is not configured');
  }
  const decoded = jwt.verify(token, options.secret, {
    algorithms: ['HS256'],
    issuer: options.issuer ?? INTERNAL_AUTH_ISSUER,
    audience: options.audience ?? INTERNAL_AUTH_AUDIENCE_API,
  }) as JwtPayload;

  return {
    sub: decoded.sub as string | number,
    scope: decoded['scope'] as InternalScope,
    permissions: (decoded['permissions'] ?? []) as Permission[],
    requestId: decoded['requestId'] as string,
    iss: decoded.iss,
    aud: typeof decoded.aud === 'string' ? decoded.aud : decoded.aud?.[0],
    iat: decoded.iat,
    exp: decoded.exp,
  };
};
