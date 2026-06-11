import type { CookieOptions, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Short-lived, integrity-protected OIDC login transaction. It binds the
 * browser that STARTED the flow to the callback, carrying the anti-CSRF
 * `state`, the anti-replay `nonce`, the PKCE `codeVerifier` and the
 * post-login `returnTo`.
 *
 * It is stored as a signed JWT inside an HttpOnly cookie (not server memory)
 * so it is tamper-proof, stateless across gateway instances, and unreadable by
 * JS. SameSite=Lax is REQUIRED: the cookie must survive the cross-site
 * top-level redirect back from the IdP (Strict would drop it).
 */
export interface SsoTransaction {
  provider: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string;
}

const TX_COOKIE = 'sso_tx';
const TX_TTL_SECONDS = 5 * 60; // 5 minutes — the handshake is short.
const TX_TYP = 'sso_tx';

// Reuse the refresh secret if a dedicated one is not provided. The transaction
// is short-lived and single-use, so this is acceptable; set SSO_STATE_SECRET in
// production to isolate it.
const secret = (): string =>
  process.env.SSO_STATE_SECRET ?? process.env.JWT_REFRESH_SECRET ?? '';

const cookieOptions = (maxAgeMs?: number): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    path: '/',
    // Lax (not Strict): the IdP redirect is a cross-site top-level GET; Strict
    // would prevent the browser from sending the transaction cookie back.
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
  if (maxAgeMs !== undefined) options.maxAge = maxAgeMs;
  return options;
};

interface SsoTransactionPayload extends JwtPayload, SsoTransaction {
  typ: typeof TX_TYP;
}

export const setTransactionCookie = (
  res: Response,
  tx: SsoTransaction,
): void => {
  if (!secret()) throw new Error('SSO state secret is not configured');
  const token = jwt.sign({ ...tx, typ: TX_TYP }, secret(), {
    algorithm: 'HS256',
    expiresIn: TX_TTL_SECONDS,
  });
  res.cookie(TX_COOKIE, token, cookieOptions(TX_TTL_SECONDS * 1000));
};

/** Reads and verifies the transaction cookie. Returns null if absent/invalid. */
export const readTransaction = (req: Request): SsoTransaction | null => {
  const token = req.cookies?.[TX_COOKIE];
  if (!token || !secret()) return null;
  try {
    const decoded = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
    }) as SsoTransactionPayload;
    if (decoded.typ !== TX_TYP) return null;
    return {
      provider: decoded.provider,
      state: decoded.state,
      nonce: decoded.nonce,
      codeVerifier: decoded.codeVerifier,
      returnTo: decoded.returnTo,
    };
  } catch {
    return null;
  }
};

/** Clears the transaction cookie — the handshake is single-use. */
export const clearTransactionCookie = (res: Response): void => {
  res.clearCookie(TX_COOKIE, cookieOptions());
};

const hasControlChars = (value: string): boolean => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
};

/**
 * Open-redirect defense: only allow a same-site absolute PATH as the
 * post-login destination. Rejects absolute URLs, protocol-relative `//evil`,
 * back-slash tricks, `javascript:` and control characters → falls back to '/'.
 */
export const safeReturnTo = (raw: unknown): string => {
  const fallback = '/';
  if (typeof raw !== 'string' || raw.length === 0) return fallback;
  if (!raw.startsWith('/')) return fallback; // must be a relative path
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback; // not protocol-relative
  if (hasControlChars(raw)) return fallback;
  return raw;
};
