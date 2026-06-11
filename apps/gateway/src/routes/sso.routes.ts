import samlController from '@gateway/controllers/saml.controller';
import ssoController from '@gateway/controllers/sso.controller';
import { Router } from 'express';

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

// SAML SP metadata for IdP onboarding. Public by design: entityID, ACS URL
// and NameID format only — never secrets or private keys.
ssoRouter.get('/:provider/metadata', samlController.metadata);

export default ssoRouter;
