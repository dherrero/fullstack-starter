import HttpResponser from '@gateway/adapters/http/http.responser';
import { ApiClient } from '@gateway/clients/api.client';
import {
  clearRefreshCookie,
  respondWithTokens,
  revokeCurrentRefreshFamily,
} from '@gateway/middleware/auth.middleware';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

class AuthController {
  login = async (req: Request, res: Response) => {
    const requestId = randomUUID();
    try {
      const { email, password } = req.body ?? {};
      // Strict boolean: any truthy non-true value (e.g. {} or "yes") must not
      // silently opt the client into the long-lived "remember me" token (T-5).
      const remember = req.body?.remember === true;
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
        requestId,
      );
      await respondWithTokens(
        res,
        {
          id: user.id,
          email: user.email,
          permissions: user.permissions,
          remember,
        },
        { issueRefreshCookie: true, requestId },
      );
      return HttpResponser.successEmpty(res);
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode ?? 401;
      return HttpResponser.errorJson(res, err as Error, status);
    }
  };

  logout = async (req: Request, res: Response) => {
    const requestId = randomUUID();
    try {
      await revokeCurrentRefreshFamily(req, requestId);
      clearRefreshCookie(res);
      return HttpResponser.successEmpty(res);
    } catch (err) {
      clearRefreshCookie(res);
      return HttpResponser.errorJson(res, err as Error);
    }
  };
}

const authController = new AuthController();
export default authController;
