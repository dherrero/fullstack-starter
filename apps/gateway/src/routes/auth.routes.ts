import authController from '@gateway/controllers/auth.controller';
import { authRateLimiter, loginRateLimiter } from '@gateway/middleware';
import { Router } from 'express';

const authRouter = Router();

// Coarse per-IP cap on the whole auth surface, plus a strict per-IP+email cap
// on login (counts only failed attempts) to resist credential stuffing.
authRouter.use(authRateLimiter);
authRouter.post('/login', loginRateLimiter, authController.login);
authRouter.post('/logout', authController.logout);

export default authRouter;
