import type { CookieOptions, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Minimal, integrity-protected hint needed to drive SAML Single Logout —
 * the SAML twin of {@link SsoLogoutHint} in `sso-logout.service.ts`. It
 * carries the provider plus the `NameID`/`SessionIndex` the IdP needs in the
 * LogoutRequest. Signed (HS256) and HttpOnly: a forged hint must never be
 * able to point the logout flow at an attacker-chosen provider or identity.
 * Best-effort: if missing/expired, logout still revokes the local session.
 */
export interface SamlLogoutHint {
  provider: string;
  nameId: string;
  nameIdFormat?: string;
  sessionIndex?: string;
}

const COOKIE = 'saml_logout';
const TYP = 'saml_logout';
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

interface SamlLogoutPayload extends JwtPayload, SamlLogoutHint {
  typ: typeof TYP;
}

export const setSamlLogoutHintCookie = (
  res: Response,
  hint: SamlLogoutHint,
): void => {
  if (!secret()) return; // best-effort; without a secret we simply skip the hint
  const token = jwt.sign({ ...hint, typ: TYP }, secret(), {
    algorithm: 'HS256',
    expiresIn: TTL_SECONDS,
  });
  res.cookie(COOKIE, token, cookieOptions(TTL_SECONDS * 1000));
};

export const readSamlLogoutHint = (req: Request): SamlLogoutHint | null => {
  const token = req.cookies?.[COOKIE];
  if (!token || !secret()) return null;
  try {
    const decoded = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
    }) as SamlLogoutPayload;
    if (decoded.typ !== TYP) return null;
    return {
      provider: decoded.provider,
      nameId: decoded.nameId,
      nameIdFormat: decoded.nameIdFormat,
      sessionIndex: decoded.sessionIndex,
    };
  } catch {
    return null;
  }
};

export const clearSamlLogoutHintCookie = (res: Response): void => {
  res.clearCookie(COOKIE, cookieOptions());
};
