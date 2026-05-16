import { refreshLifecycleController } from '@api/controllers';
import { InternalScope, requireInternalAuth } from '@internal-auth';
import { Router } from 'express';

const refreshLifecycleRouter = Router();

const requireRefreshScope = requireInternalAuth({
  publicKey: process.env.INTERNAL_JWT_PUBLIC_KEY ?? '',
  allowedScopes: [InternalScope.REFRESH_LIFECYCLE],
});

refreshLifecycleRouter.post(
  '/record',
  requireRefreshScope,
  refreshLifecycleController.record,
);
refreshLifecycleRouter.post(
  '/rotate',
  requireRefreshScope,
  refreshLifecycleController.rotate,
);
refreshLifecycleRouter.post(
  '/revoke',
  requireRefreshScope,
  refreshLifecycleController.revoke,
);

export default refreshLifecycleRouter;
