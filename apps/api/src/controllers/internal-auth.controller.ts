import HttpResponser from '@api/adapters/http/http.responser';
import { authService } from '@api/services';
import type { Request, Response } from 'express';

class InternalAuthController {
  /**
   * Validates credentials submitted by the gateway during login.
   * The endpoint is only reachable through `requireInternalAuth` with the
   * `auth.validate` scope, so the gateway is the only legitimate caller.
   */
  validate = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (!email || !password) {
        return HttpResponser.errorJson(
          res,
          { message: 'Missing credentials' },
          400,
        );
      }
      const user = await authService.validateCredentials(email, password);
      return HttpResponser.successJson(res, {
        id: user.id,
        email: user.email,
        permissions: user.permissions,
      });
    } catch (err) {
      return HttpResponser.errorJson(res, err, 401);
    }
  };
}

const internalAuthController = new InternalAuthController();
export default internalAuthController;
