import { Router } from 'express';
import healthRouter from './health.routes';
import internalAuthRouter from './internal-auth.routes';
import userCrudRouter from './user-crud.routes';

const api = Router();

/** gateway → api system routes, scope auth.validate */
api.use('/internal/auth', internalAuthRouter);

/** business endpoints proxied from the gateway, scope user.request */
api.use('/v1/user', userCrudRouter);

/** health probes (reachable from inside the internal network only) */
api.use('/v1/health', healthRouter);

export default api;
