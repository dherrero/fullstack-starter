/**
 * Constants shared by gateway and downstream services so the contract
 * (header name, issuer, audience) is enforced from a single source.
 */
export const INTERNAL_AUTH_HEADER = 'x-internal-auth';
export const INTERNAL_REQUEST_ID_HEADER = 'x-request-id';
export const INTERNAL_AUTH_ISSUER = 'gateway';
export const INTERNAL_AUTH_AUDIENCE_API = 'api';
export const INTERNAL_AUTH_DEFAULT_TTL_SECONDS = 60;

export const INTERNAL_SYSTEM_SUBJECT = 'system';

export enum InternalScope {
  USER_REQUEST = 'user.request',
  AUTH_VALIDATE = 'auth.validate',
  REFRESH_LIFECYCLE = 'refresh.lifecycle',
}
