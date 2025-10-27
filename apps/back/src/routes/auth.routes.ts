import { authController } from '@back/controllers';
import { Router } from 'express';

const authRouter = Router();

authRouter.post('/login', authController.login);
authRouter.post('/logout', authController.logout);

export default authRouter;
