import type { Permission } from '@dto';
import type { InternalScope } from './internal-auth.constants';

/**
 * Claims carried by the short-lived JWT placed in the `X-Internal-Auth`
 * header on every gateway → downstream request. Downstream services rely
 * on these claims instead of re-verifying the public client token.
 */
export interface InternalAuthClaims {
  sub: string | number;
  scope: InternalScope;
  permissions: Permission[];
  requestId: string;
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

export interface InternalAuthSignOptions {
  secret: string;
  ttlSeconds?: number;
  issuer?: string;
  audience?: string;
}

export interface InternalAuthVerifyOptions {
  secret: string;
  issuer?: string;
  audience?: string;
}
