import samlController from '@gateway/controllers/saml.controller';
import ssoController from '@gateway/controllers/sso.controller';
import express, { Router } from 'express';

// All routes here inherit the coarse per-IP authRateLimiter mounted on the
// auth router (see auth.routes.ts) — including SAML login/metadata.
const ssoRouter = Router();

// Public list for the SPA login screen.
ssoRouter.get('/providers', ssoController.providers);

// RP-initiated logout (revokes the local session, then ends the IdP session
// when federated). GET so the SPA can navigate to it (top-level redirect).
ssoRouter.get('/logout', ssoController.logout);

// Federated handshake (OIDC code+PKCE or SAML AuthnRequest — the controller
// dispatches by protocol). `:provider` is validated against the registry
// inside the controller (no arbitrary providers).
ssoRouter.get('/:provider/login', ssoController.login);
ssoRouter.get('/:provider/callback', ssoController.callback);

// SAML Assertion Consumer Service (HTTP-POST binding). The urlencoded parser
// is mounted ONLY here, with an explicit cap (encrypted responses grow, but
// 256kb bounds XML-bomb/DoS payloads). The route is necessarily exempt from
// cookie-based CSRF (it is a cross-site POST from the IdP) — protection comes
// from the signed single-use transaction cookie + InResponseTo binding.
ssoRouter.post(
  '/:provider/callback',
  express.urlencoded({ extended: false, limit: '256kb' }),
  samlController.callback,
);

// SAML SLO response landing (Redirect or POST binding). Validation failures
// are silently ignored: the local session was fully revoked before the IdP
// round-trip started, so a forged LogoutResponse can change no state.
ssoRouter.get('/:provider/logout/callback', samlController.logoutCallback);
ssoRouter.post(
  '/:provider/logout/callback',
  express.urlencoded({ extended: false, limit: '256kb' }),
  samlController.logoutCallback,
);

// SAML SP metadata for IdP onboarding. Public by design: entityID, ACS URL
// and NameID format only — never secrets or private keys.
ssoRouter.get('/:provider/metadata', samlController.metadata);

export default ssoRouter;
