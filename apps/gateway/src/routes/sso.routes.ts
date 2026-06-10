import ssoController from '@gateway/controllers/sso.controller';
import { Router } from 'express';

const ssoRouter = Router();

// Public list for the SPA login screen.
ssoRouter.get('/providers', ssoController.providers);

// OIDC Authorization Code + PKCE handshake. `:provider` is validated against
// the registry inside the controller (no arbitrary providers).
ssoRouter.get('/:provider/login', ssoController.login);
ssoRouter.get('/:provider/callback', ssoController.callback);

export default ssoRouter;
