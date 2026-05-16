import { internalAuthController } from '@api/controllers';
import { InternalScope, requireInternalAuth } from '@internal-auth';
import { Router } from 'express';

const internalAuthRouter = Router();

const requireSystemAuth = requireInternalAuth({
  secret: process.env.INTERNAL_JWT_SECRET ?? '',
  allowedScopes: [InternalScope.AUTH_VALIDATE],
});

internalAuthRouter.post(
  '/validate',
  requireSystemAuth,
  internalAuthController.validate,
);

export default internalAuthRouter;
