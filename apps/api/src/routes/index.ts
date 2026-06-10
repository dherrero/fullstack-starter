import { Router } from 'express';
import federatedIdentityRouter from './federated-identity.routes';
import healthRouter from './health.routes';
import internalAuthRouter from './internal-auth.routes';
import refreshLifecycleRouter from './refresh-lifecycle.routes';
import userCrudRouter from './user-crud.routes';

const api = Router();

/** gateway → api auth bootstrap (scope auth.validate) */
api.use('/internal/auth', internalAuthRouter);

/** gateway → api refresh-token lifecycle (scope refresh.lifecycle) */
api.use('/internal/refresh', refreshLifecycleRouter);

/** gateway → api federated identity resolve/provision (scope federated.identity) */
api.use('/internal/federated', federatedIdentityRouter);

/** business endpoints proxied from the gateway (scope user.request) */
api.use('/v1/user', userCrudRouter);

/** health probes (reachable from inside the internal network only) */
api.use('/v1/health', healthRouter);

export default api;
