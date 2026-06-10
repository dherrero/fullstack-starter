import type { CookieOptions, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Minimal, integrity-protected hint needed to drive RP-initiated logout
 * (OIDC end_session): which provider issued the session and the `id_token`
 * to pass as `id_token_hint`. Stored in a signed HttpOnly cookie — the ID
 * token is an already-consumed assertion (not a credential like the refresh
 * token), is never exposed to JS (HttpOnly), and the hint is best-effort: if
 * it is missing/expired, logout still revokes the local session.
 */
export interface SsoLogoutHint {
  provider: string;
  idToken: string;
}

const COOKIE = 'sso_logout';
const TYP = 'sso_logout';
const TTL_SECONDS = 8 * 60 * 60; // align with the default (non-remember) session

const secret = (): string =>
  process.env.SSO_STATE_SECRET ?? process.env.JWT_REFRESH_SECRET ?? '';

const cookieOptions = (maxAgeMs?: number): CookieOptions => {
  const options: CookieOptions = {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
  if (maxAgeMs !== undefined) options.maxAge = maxAgeMs;
  return options;
};

interface SsoLogoutPayload extends JwtPayload, SsoLogoutHint {
  typ: typeof TYP;
}

export const setLogoutHintCookie = (
  res: Response,
  hint: SsoLogoutHint,
): void => {
  if (!secret()) return; // best-effort; without a secret we simply skip the hint
  const token = jwt.sign({ ...hint, typ: TYP }, secret(), {
    algorithm: 'HS256',
    expiresIn: TTL_SECONDS,
  });
  res.cookie(COOKIE, token, cookieOptions(TTL_SECONDS * 1000));
};

export const readLogoutHint = (req: Request): SsoLogoutHint | null => {
  const token = req.cookies?.[COOKIE];
  if (!token || !secret()) return null;
  try {
    const decoded = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
    }) as SsoLogoutPayload;
    if (decoded.typ !== TYP) return null;
    return { provider: decoded.provider, idToken: decoded.idToken };
  } catch {
    return null;
  }
};

export const clearLogoutHintCookie = (res: Response): void => {
  res.clearCookie(COOKIE, cookieOptions());
};
