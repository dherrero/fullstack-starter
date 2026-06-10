import { federatedIdentityController } from '@api/controllers';
import { validate } from '@api/middleware';
import { InternalScope, requireInternalAuth } from '@internal-auth';
import { resolveFederatedUserSchema } from '@dto';
import { Router } from 'express';

const federatedIdentityRouter = Router();

const requireFederatedAuth = requireInternalAuth({
  publicKey: process.env.INTERNAL_JWT_PUBLIC_KEY ?? '',
  allowedScopes: [InternalScope.FEDERATED_IDENTITY],
});

federatedIdentityRouter.post(
  '/resolve',
  requireFederatedAuth,
  validate(resolveFederatedUserSchema),
  federatedIdentityController.resolve,
);

export default federatedIdentityRouter;
