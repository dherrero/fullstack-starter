import HttpResponser from '@gateway/adapters/http/http.responser';
import { ApiClient } from '@gateway/clients/api.client';
import { respondWithTokens } from '@gateway/middleware/auth.middleware';
import { getClient } from '@gateway/sso/discovery';
import { mapGroupsToPermissions } from '@gateway/sso/permission-mapper';
import {
  getProviderConfig,
  listPublicProviders,
} from '@gateway/sso/provider-registry';
import {
  clearTransactionCookie,
  readTransaction,
  safeReturnTo,
  setTransactionCookie,
} from '@gateway/sso/sso-transaction.service';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { generators } from 'openid-client';

// Where the SPA lands when SSO fails. A relative path so it can never be an
// open redirect, and it carries no IdP error detail (avoids leakage).
const SSO_ERROR_REDIRECT = '/login?sso_error=1';

class SsoController {
  /** Public provider metadata for the SPA to render login buttons. */
  providers = (_req: Request, res: Response) =>
    HttpResponser.successJson(res, listPublicProviders());

  /**
   * Start the Authorization Code + PKCE flow: mint state/nonce/PKCE, stash
   * them in the signed transaction cookie, and redirect to the IdP.
   */
  login = async (req: Request, res: Response) => {
    const providerId = req.params.provider as string;
    const config = getProviderConfig(providerId);
    if (!config) {
      return HttpResponser.errorJson(res, { message: 'Unknown provider' }, 404);
    }

    try {
      const client = await getClient(providerId);
      const state = generators.state();
      const nonce = generators.nonce();
      const codeVerifier = generators.codeVerifier();
      const codeChallenge = generators.codeChallenge(codeVerifier);
      const returnTo = safeReturnTo(req.query.returnTo);

      setTransactionCookie(res, {
        provider: providerId,
        state,
        nonce,
        codeVerifier,
        returnTo,
      });

      const url = client.authorizationUrl({
        scope: config.scopes,
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        redirect_uri: config.redirectUri,
      });
      return res.redirect(url);
    } catch {
      return res.redirect(SSO_ERROR_REDIRECT);
    }
  };

  /**
   * IdP redirect target: validate state (CSRF) against the transaction cookie,
   * exchange the code with PKCE, let openid-client validate the ID token
   * (signature/iss/aud/exp/nonce), then issue the SAME local session as a
   * password login and redirect to a vetted same-site path.
   */
  callback = async (req: Request, res: Response) => {
    const providerId = req.params.provider as string;
    const config = getProviderConfig(providerId);
    if (!config) {
      return HttpResponser.errorJson(res, { message: 'Unknown provider' }, 404);
    }

    // Single-use: read then immediately clear the transaction cookie.
    const tx = readTransaction(req);
    clearTransactionCookie(res);

    // Mix-up defense: the transaction must exist and belong to the SAME
    // provider that started the flow.
    if (!tx || tx.provider !== providerId) {
      return res.redirect(SSO_ERROR_REDIRECT);
    }

    const requestId = randomUUID();
    try {
      const client = await getClient(providerId);
      const params = client.callbackParams(req);
      // openid-client enforces state match, nonce match, ID-token signature
      // (via JWKS), iss, aud and exp. A bad/replayed/expired token throws.
      const tokenSet = await client.callback(config.redirectUri, params, {
        state: tx.state,
        nonce: tx.nonce,
        code_verifier: tx.codeVerifier,
      });
      const claims = tokenSet.claims();

      const email = typeof claims.email === 'string' ? claims.email : '';
      // Some IdPs send email_verified as a string; accept both forms.
      const ev = claims.email_verified as boolean | string | undefined;
      const emailVerified = ev === true || ev === 'true';
      const suggestedPermissions = mapGroupsToPermissions(
        claims[config.groupsClaim],
        config.permissionMap,
      );

      const user = await ApiClient.resolveFederatedUser(
        {
          provider: providerId,
          subject: claims.sub,
          email,
          emailVerified,
          suggestedPermissions,
        },
        requestId,
      );

      await respondWithTokens(
        res,
        { id: user.id, email: user.email, permissions: user.permissions },
        { issueRefreshCookie: true, requestId },
      );
      return res.redirect(safeReturnTo(tx.returnTo));
    } catch {
      // Never reflect the IdP error_description (XSS / info-leak); generic only.
      return res.redirect(SSO_ERROR_REDIRECT);
    }
  };
}

const ssoController = new SsoController();
export default ssoController;
