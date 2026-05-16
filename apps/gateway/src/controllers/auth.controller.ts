import HttpResponser from '@gateway/adapters/http/http.responser';
import { ApiClient } from '@gateway/clients/api.client';
import {
  clearRefreshCookie,
  respondWithTokens,
} from '@gateway/middleware/auth.middleware';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

class AuthController {
  login = async (req: Request, res: Response) => {
    try {
      const { email, password, remember } = req.body ?? {};
      if (!email || !password) {
        return HttpResponser.errorJson(
          res,
          { message: 'Missing credentials' },
          400,
        );
      }

      const user = await ApiClient.validateCredentials(
        email,
        password,
        randomUUID(),
      );
      await respondWithTokens(
        res,
        {
          id: user.id,
          email: user.email,
          permissions: user.permissions,
          remember,
        },
        { issueRefreshCookie: true },
      );
      return HttpResponser.successEmpty(res);
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode ?? 401;
      return HttpResponser.errorJson(res, err as Error, status);
    }
  };

  logout = async (_req: Request, res: Response) => {
    try {
      clearRefreshCookie(res);
      return HttpResponser.successEmpty(res);
    } catch (err) {
      return HttpResponser.errorJson(res, err as Error);
    }
  };
}

const authController = new AuthController();
export default authController;
