import authController from '@gateway/controllers/auth.controller';
import { Router } from 'express';

const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/logout', authController.logout);

export default authRouter;
