import { Router } from 'express';
import authRouter from './auth.routes';
import healthRouter from './health.routes';
import userCrudRouter from './user-crud.routes';

const api = Router();

/** public api */
api.use('/v1/auth', authRouter);

/** private api */
api.use('/v1/user', userCrudRouter);

/** health check */
api.use('/v1/health', healthRouter);

export default api;
