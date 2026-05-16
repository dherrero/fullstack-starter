import { Router } from 'express';
import authRouter from './auth.routes';
import healthRouter from './health.routes';
import { buildProxyRouter } from './proxy.routes';

const api = Router();

api.use('/v1/auth', authRouter);
api.use('/v1/health', healthRouter);

/**
 * Everything else under /v1 is forwarded to the api service. Routes
 * declared above (auth + health) take precedence — Express matches by
 * registration order.
 */
api.use('/v1', buildProxyRouter());

export default api;
