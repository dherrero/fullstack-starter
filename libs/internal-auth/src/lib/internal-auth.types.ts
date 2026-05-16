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

/**
 * Sign options: an Ed25519 private key (PEM). Only the gateway holds
 * this key — downstream services cannot mint tokens, only verify them.
 */
export interface InternalAuthSignOptions {
  privateKey: string;
  ttlSeconds?: number;
  issuer?: string;
  audience?: string;
}

/**
 * Verify options: an Ed25519 public key (PEM). Downstream services use
 * this to authenticate incoming gateway tokens without ever being able
 * to forge new ones themselves.
 */
export interface InternalAuthVerifyOptions {
  publicKey: string;
  issuer?: string;
  audience?: string;
}
