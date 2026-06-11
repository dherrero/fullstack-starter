import HttpResponser from '@gateway/adapters/http/http.responser';
import { ApiClient } from '@gateway/clients/api.client';
import { respondWithTokens } from '@gateway/middleware/auth.middleware';
import { getFederatedProvider } from '@gateway/sso/federated-registry';
import { mapGroupsToPermissions } from '@gateway/sso/permission-mapper';
import { generateSamlRequestId, getSamlClient } from '@gateway/sso/saml-client';
import {
  SamlLogoutHint,
  setSamlLogoutHintCookie,
} from '@gateway/sso/saml-logout.service';
import {
  clearSamlTransactionCookie,
  readSamlTransaction,
  setSamlTransactionCookie,
} from '@gateway/sso/saml-transaction.service';
import { safeReturnTo } from '@gateway/sso/sso-transaction.service';
import type { Profile } from '@node-saml/node-saml';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

// Where the SPA lands when SSO fails. A relative path so it can never be an
// open redirect, and it carries no IdP error detail (avoids leakage).
const SSO_ERROR_REDIRECT = '/login?sso_error=1';

// NameID formats whose (provider, subject) link is stable across logins.
// `transient` is rejected by design — a per-session identifier must never key
// a federated identity. `unspecified` is also rejected: an explicit allowlist
// fails closed; legacy IdPs should be configured to emit persistent NameIDs
// (our AuthnRequest requests the persistent format).
const ACCEPTED_NAMEID_FORMATS = [
  'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
  'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
];

// Pragmatic email shape check on the asserted attribute. The API re-validates
// with zod (`z.string().email()`); this gate exists so an obviously broken or
// hostile value never leaves the gateway. Angle brackets and control chars are
// rejected outright (comment-injection / log-injection defense in depth).
const isPlausibleEmail = (value: string): boolean => {
  if (value.length === 0 || value.length > 150) return false;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return false;
  }
  if (/[<>"'`\\]/.test(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

/** First string value of a (possibly multi-valued) SAML attribute. */
const attributeAsString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

/** Looks up the provider and narrows to SAML; undefined for unknown/OIDC. */
const samlProvider = (req: Request) => {
  const fed = getFederatedProvider(req.params.provider as string);
  return fed?.protocol === 'saml' ? fed.config : undefined;
};

class SamlController {
  /**
   * SP-initiated login: mint a CSPRNG AuthnRequest id, persist it together
   * with the vetted `returnTo` in the signed transaction cookie, and redirect
   * to the IdP (HTTP-Redirect binding).
   *
   * RelayState is deliberately EMPTY: the post-login destination travels only
   * inside the signed cookie, so a tampered RelayState can never become an
   * open redirect.
   */
  login = async (req: Request, res: Response) => {
    const config = samlProvider(req);
    if (!config) {
      // Generic message — never echo the :provider param (reflection/XSS).
      return HttpResponser.errorJson(res, { message: 'Unknown provider' }, 404);
    }

    try {
      const requestId = generateSamlRequestId();
      const returnTo = safeReturnTo(req.query.returnTo);
      const saml = getSamlClient(config.id, requestId);
      const url = await saml.getAuthorizeUrlAsync('', undefined, {});

      setSamlTransactionCookie(res, {
        provider: config.id,
        requestId,
        returnTo,
      });
      return res.redirect(url);
    } catch {
      return res.redirect(SSO_ERROR_REDIRECT);
    }
  };

  /**
   * Assertion Consumer Service (HTTP-POST binding) — the security heart of
   * the SAML flow. Validation chain (every step fail-closed, none of it
   * disableable through env):
   *
   *  1. The signed transaction cookie must exist and belong to the SAME
   *     provider that started the flow (read + cleared: single-use). Its
   *     absence means the response is unsolicited → IdP-initiated SSO is
   *     rejected by design.
   *  2. node-saml (hardened in saml-client.ts) verifies: XML signature on the
   *     Response AND the Assertion against the registry's pinned cert(s) only
   *     (never certs embedded in the response), Status == Success,
   *     Conditions/NotBefore/NotOnOrAfter with bounded skew, AudienceRestriction
   *     == our SP entityID, response Issuer == configured idpIssuer (mix-up
   *     defense), InResponseTo present in its request cache (single-use).
   *  3. The response's InResponseTo must equal the AuthnRequest id from the
   *     transaction cookie — binds the response to the browser that started
   *     the flow (anti-CSRF on a route that is necessarily CSRF-exempt).
   *  4. NameID must use a stable format (persistent/emailAddress; transient
   *     rejected) and the asserted email must be plausible and — when
   *     `allowedDomains` is configured — inside the tenant's domain allowlist
   *     (cross-tenant assertion containment).
   *
   * `emailVerified: true` is a documented policy decision: the tenant's IdP is
   * authoritative for its own domain, the operator configures it explicitly,
   * and `allowedDomains` bounds the blast radius.
   *
   * Errors NEVER reflect IdP status/XML back to the browser (XSS/info-leak):
   * generic redirect only, structured log keyed by an internal requestId.
   */
  callback = async (req: Request, res: Response) => {
    const config = samlProvider(req);
    if (!config) {
      return HttpResponser.errorJson(res, { message: 'Unknown provider' }, 404);
    }

    // Single-use: read then immediately clear the transaction cookie.
    const tx = readSamlTransaction(req);
    clearSamlTransactionCookie(res);
    if (!tx || tx.provider !== config.id) {
      return res.redirect(SSO_ERROR_REDIRECT);
    }

    const requestId = randomUUID();
    try {
      const saml = getSamlClient(config.id);
      const { profile, loggedOut } = await saml.validatePostResponseAsync(
        (req.body ?? {}) as Record<string, string>,
      );
      if (loggedOut || !profile)
        throw new Error('SAML: no profile in response');

      // InResponseTo ⇄ transaction binding (on top of node-saml's own cache).
      if (profile.inResponseTo !== tx.requestId) {
        throw new Error('SAML: InResponseTo does not match the transaction');
      }

      // Stable-identifier policy: reject transient (and anything not
      // explicitly allowed). The (provider, subject) pair keys the account.
      if (
        !profile.nameID ||
        !ACCEPTED_NAMEID_FORMATS.includes(profile.nameIDFormat)
      ) {
        throw new Error('SAML: NameID missing or non-persistent format');
      }

      const email = (
        attributeAsString(profile[config.emailAttribute]) ??
        (profile.nameIDFormat === ACCEPTED_NAMEID_FORMATS[1]
          ? profile.nameID
          : '')
      )
        .trim()
        .toLowerCase();
      if (!isPlausibleEmail(email)) {
        throw new Error('SAML: asserted email is missing or malformed');
      }

      // Cross-tenant containment: an IdP may only assert emails inside its
      // configured domain allowlist.
      if (config.allowedDomains?.length) {
        const domain = email.slice(email.lastIndexOf('@') + 1);
        if (!config.allowedDomains.includes(domain)) {
          throw new Error('SAML: asserted email domain is not allowed');
        }
      }

      const suggestedPermissions = mapGroupsToPermissions(
        profile[config.groupsAttribute],
        config.permissionMap,
      );

      const user = await ApiClient.resolveFederatedUser(
        {
          provider: config.id,
          subject: profile.nameID,
          email,
          emailVerified: true,
          suggestedPermissions,
        },
        requestId,
      );

      await respondWithTokens(
        res,
        { id: user.id, email: user.email, permissions: user.permissions },
        { issueRefreshCookie: true, requestId },
      );

      // Best-effort SLO hint so logout can also end the IdP session (T-37).
      setSamlLogoutHintCookie(res, {
        provider: config.id,
        nameId: profile.nameID,
        nameIdFormat: profile.nameIDFormat,
        sessionIndex: profile.sessionIndex,
      });

      return res.redirect(safeReturnTo(tx.returnTo));
    } catch (err) {
      // Internal, structured log only — NEVER the raw response or IdP status
      // to the browser. The message may carry IdP-controlled fragments, so it
      // is stripped of control characters and truncated (log-injection
      // defense) before logging.
      const reason = (err instanceof Error ? err.message : 'unknown error')
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f\x7f]+/g, ' ')
        .slice(0, 200);
      console.warn(
        `[SAML] ACS rejected a response (provider="${config.id}", requestId="${requestId}"): ${reason}`,
      );
      return res.redirect(SSO_ERROR_REDIRECT);
    }
  };

  /**
   * SP metadata for IdP onboarding. Public by design: it only carries the SP
   * entityID, the ACS URL and the requested NameID format — never private
   * keys (we neither sign AuthnRequests nor publish the decryption cert here;
   * encrypted-assertion certs are exchanged with the IdP out-of-band).
   */
  metadata = (req: Request, res: Response) => {
    const config = samlProvider(req);
    if (!config) {
      return HttpResponser.errorJson(res, { message: 'Unknown provider' }, 404);
    }

    try {
      const xml = getSamlClient(config.id).generateServiceProviderMetadata(
        null,
        null,
      );
      return res.type('application/samlmetadata+xml').send(xml);
    } catch {
      return HttpResponser.errorJson(
        res,
        { message: 'Metadata unavailable' },
        500,
      );
    }
  };

  /**
   * Builds the IdP SLO redirect URL for a logout hint (HTTP-Redirect
   * binding), or null when SLO is not possible. STRICTLY best-effort: the
   * caller has ALWAYS revoked the local refresh family before calling this —
   * a null/throwing result only skips the IdP round-trip, never keeps a
   * local session alive.
   *
   * The LogoutRequest is unsigned: signing would require an SP private key,
   * which this starter deliberately does not manage (documented in
   * SECURITY.md). RelayState carries only a local relative path and is
   * re-validated with `safeReturnTo` when the IdP lands back on the SLO
   * callback.
   */
  sloRedirectUrl = async (
    hint: SamlLogoutHint,
    relayState: string,
  ): Promise<string | null> => {
    const fed = getFederatedProvider(hint.provider);
    if (fed?.protocol !== 'saml' || !fed.config.logoutUrl) return null;

    try {
      const saml = getSamlClient(hint.provider);
      const profile: Profile = {
        issuer: fed.config.idpIssuer,
        nameID: hint.nameId,
        nameIDFormat:
          hint.nameIdFormat ??
          'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
        ...(hint.sessionIndex ? { sessionIndex: hint.sessionIndex } : {}),
      };
      return await saml.getLogoutUrlAsync(
        profile,
        safeReturnTo(relayState),
        {},
      );
    } catch {
      return null; // best-effort: fall back to the local redirect
    }
  };

  /**
   * SLO response landing (GET = HTTP-Redirect binding, POST = HTTP-POST
   * binding). The LogoutResponse is validated when possible (signature if
   * present, InResponseTo against the request cache); ANY failure is ignored
   * silently — by the time the IdP sends us here the local session is already
   * fully revoked, so a forged/broken LogoutResponse can produce no state
   * change. We simply land the browser on a vetted local path.
   */
  logoutCallback = async (req: Request, res: Response) => {
    const config = samlProvider(req);
    const relayState =
      (typeof req.query?.RelayState === 'string' && req.query.RelayState) ||
      (typeof req.body?.RelayState === 'string' && req.body.RelayState) ||
      '/login';

    if (config) {
      try {
        const saml = getSamlClient(config.id);
        if (req.method === 'POST') {
          await saml.validatePostResponseAsync(
            (req.body ?? {}) as Record<string, string>,
          );
        } else if (typeof req.query?.SAMLResponse === 'string') {
          const originalQuery = req.originalUrl.split('?')[1] ?? '';
          await saml.validateRedirectAsync(
            req.query as Record<string, string>,
            originalQuery,
          );
        }
      } catch {
        /* silent — no state change is possible here */
      }
    }
    return res.redirect(safeReturnTo(relayState));
  };
}

const samlController = new SamlController();
export default samlController;
