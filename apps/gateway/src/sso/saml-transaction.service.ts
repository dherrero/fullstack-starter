import type { CookieOptions, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';

/**
 * Short-lived, integrity-protected SAML login transaction — the SAML twin of
 * {@link SsoTransaction} in `sso-transaction.service.ts`. It binds the browser
 * that STARTED the flow to the ACS callback, carrying the AuthnRequest id
 * (validated against `InResponseTo`) and the vetted post-login `returnTo`.
 * `returnTo` ALWAYS travels here, in the signed cookie — RelayState is never
 * trusted for the final redirect (open-redirect defense).
 *
 * Cookie SameSite, unlike OIDC: the ACS is a cross-site top-level POST from
 * the IdP. `Lax` only attaches cookies to cross-site top-level GETs, so in
 * production this cookie must be `SameSite=None; Secure` to reach the ACS.
 * In dev (no https) `None; Secure` would be dropped by the browser, so we
 * fall back to `Lax` — meaning the full SAML handshake against a real IdP
 * requires https (production parity); dev coverage comes from the e2e suite
 * which posts same-site.
 */
export interface SamlTransaction {
  provider: string;
  /** The AuthnRequest `ID` — must equal the response's `InResponseTo`. */
  requestId: string;
  returnTo: string;
}

const TX_COOKIE = 'saml_tx';
const TX_TTL_SECONDS = 5 * 60; // 5 minutes — the handshake is short.
const TX_TYP = 'saml_tx';

// Same secret strategy as the OIDC transaction cookie: a dedicated
// SSO_STATE_SECRET, falling back to the refresh secret.
const secret = (): string =>
  process.env.SSO_STATE_SECRET ?? process.env.JWT_REFRESH_SECRET ?? '';

const cookieOptions = (maxAgeMs?: number): CookieOptions => {
  const production = process.env.NODE_ENV === 'production';
  const options: CookieOptions = {
    httpOnly: true,
    path: '/',
    // See the interface JSDoc: None+Secure in production (cross-site POST to
    // the ACS), Lax in dev where Secure cookies are unavailable over http.
    sameSite: production ? 'none' : 'lax',
    secure: production,
  };
  if (maxAgeMs !== undefined) options.maxAge = maxAgeMs;
  return options;
};

interface SamlTransactionPayload extends JwtPayload, SamlTransaction {
  typ: typeof TX_TYP;
}

export const setSamlTransactionCookie = (
  res: Response,
  tx: SamlTransaction,
): void => {
  if (!secret()) throw new Error('SSO state secret is not configured');
  const token = jwt.sign({ ...tx, typ: TX_TYP }, secret(), {
    algorithm: 'HS256',
    expiresIn: TX_TTL_SECONDS,
  });
  res.cookie(TX_COOKIE, token, cookieOptions(TX_TTL_SECONDS * 1000));
};

/** Reads and verifies the SAML transaction cookie. Null if absent/invalid. */
export const readSamlTransaction = (req: Request): SamlTransaction | null => {
  const token = req.cookies?.[TX_COOKIE];
  if (!token || !secret()) return null;
  try {
    const decoded = jwt.verify(token, secret(), {
      algorithms: ['HS256'],
    }) as SamlTransactionPayload;
    if (decoded.typ !== TX_TYP) return null;
    return {
      provider: decoded.provider,
      requestId: decoded.requestId,
      returnTo: decoded.returnTo,
    };
  } catch {
    return null;
  }
};

/** Clears the SAML transaction cookie — the handshake is single-use. */
export const clearSamlTransactionCookie = (res: Response): void => {
  res.clearCookie(TX_COOKIE, cookieOptions());
};
