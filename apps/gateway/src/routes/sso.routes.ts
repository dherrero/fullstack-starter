import ssoController from '@gateway/controllers/sso.controller';
import { Router } from 'express';

const ssoRouter = Router();

// Public list for the SPA login screen.
ssoRouter.get('/providers', ssoController.providers);

// RP-initiated logout (revokes the local session, then ends the IdP session
// when federated). GET so the SPA can navigate to it (top-level redirect).
ssoRouter.get('/logout', ssoController.logout);

// OIDC Authorization Code + PKCE handshake. `:provider` is validated against
// the registry inside the controller (no arbitrary providers).
ssoRouter.get('/:provider/login', ssoController.login);
ssoRouter.get('/:provider/callback', ssoController.callback);

export default ssoRouter;
