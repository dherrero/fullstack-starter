import HttpResponser from '@gateway/adapters/http/http.responser';
import { getFederatedProvider } from '@gateway/sso/federated-registry';
import { generateSamlRequestId, getSamlClient } from '@gateway/sso/saml-client';
import { setSamlTransactionCookie } from '@gateway/sso/saml-transaction.service';
import { safeReturnTo } from '@gateway/sso/sso-transaction.service';
import type { Request, Response } from 'express';

// Where the SPA lands when SSO fails. A relative path so it can never be an
// open redirect, and it carries no IdP error detail (avoids leakage).
const SSO_ERROR_REDIRECT = '/login?sso_error=1';

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
}

const samlController = new SamlController();
export default samlController;
