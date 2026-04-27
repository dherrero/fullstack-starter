import HttpResponser from '@back/adapters/http/http.responser';
import { authService } from '@back/services';
import { Permission } from '@dto';
import { CookieOptions, NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

class AuthController {
  login = async (req: Request, res: Response) => {
    try {
      const { email, password, remember } = req.body;
      const user = await authService.login(email, password);
      const userData = {
        id: user.id,
        email: user.email,
        permissions: user.permissions,
        remember,
      };
      return this.#responseWithTokens(res, userData);
    } catch (err) {
      console.log(err);
      return HttpResponser.errorJson(res, err);
    }
  };

  logout = async (_req: Request, res: Response) => {
    try {
      // Clear the refreshToken cookie with same options as when set
      const cookieOptions: CookieOptions = {
        httpOnly: true,
        path: '/',
      };

      if (process.env.NODE_ENV === 'production') {
        cookieOptions.secure = true;
        cookieOptions.sameSite = 'strict';
      } else {
        cookieOptions.secure = false;
        cookieOptions.sameSite = 'lax';
      }

      res.clearCookie('refreshToken', cookieOptions);
      return HttpResponser.successEmpty(res);
    } catch (err) {
      console.log(err);
      return HttpResponser.errorJson(res, err);
    }
  };

  hasPermission =
    (requiredPermission?: Permission | Permission[]) =>
    async (req: Request, res: Response, next: NextFunction) => {
      if (req.method === 'OPTIONS') {
        return next();
      }

      const token = req.header('Authorization');
      const refreshToken = req.cookies?.refreshToken;
      const randomCode = Math.floor(Math.random() * 1000);

      // Case 1: No RefreshToken cookie - Must login
      if (!refreshToken) {
        return HttpResponser.errorJson(
          res,
          { message: `Access denied: No refresh token code: ${randomCode}0` },
          401,
        );
      }

      // Case 2: No AccessToken - Try to generate from RefreshToken
      if (!token) {
        console.log('[Auth] No AccessToken, attempting to refresh from cookie');
        return this.#refreshTokenAndCheckPermissions(
          req,
          res,
          next,
          requiredPermission,
        );
      }

      // Case 3: Has AccessToken - Verify it
      try {
        const decode = authService.verifyToken(token);
        res.locals.user = { ...decode };

        // Check permissions if required
        if (
          requiredPermission &&
          !this.#checkPermissions(decode.permissions, requiredPermission)
        ) {
          return HttpResponser.errorJson(
            res,
            {
              message: `Access denied: Insufficient permissions code: ${randomCode}2`,
            },
            401,
          );
        }

        next();
      } catch (error) {
        // Case 4: AccessToken expired - Refresh from cookie
        if (error instanceof TokenExpiredError) {
          console.log('[Auth] AccessToken expired, refreshing from cookie');
          return this.#refreshTokenAndCheckPermissions(
            req,
            res,
            next,
            requiredPermission,
          );
        } else {
          return HttpResponser.errorJson(
            res,
            { message: 'Invalid token' },
            401,
          );
        }
      }
    };

  #checkPermissions(
    userPermissions: Permission[],
    requiredPermission: Permission | Permission[],
  ): boolean {
    if (!userPermissions || !Array.isArray(userPermissions)) {
      return false;
    }

    if (Array.isArray(requiredPermission)) {
      return requiredPermission.some((perm) => userPermissions.includes(perm));
    }

    return userPermissions.includes(requiredPermission);
  }

  #refreshTokenAndCheckPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
    requiredPermission?: Permission | Permission[],
  ) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return HttpResponser.errorJson(
        res,
        { message: 'Access Denied. No refresh token provided.' },
        401,
      );
    }

    try {
      const decode = authService.verifyToken(refreshToken);
      const user = await authService.getUser(decode.id);
      const userData = {
        id: user.id,
        email: user.email,
        remember: decode.remember,
        permissions: user.permissions,
      };

      // Check permissions if required
      if (
        requiredPermission &&
        !this.#checkPermissions(user.permissions, requiredPermission)
      ) {
        return HttpResponser.errorJson(
          res,
          { message: 'Access denied: Insufficient permissions' },
          401,
        );
      }

      res.locals.user = { ...userData };
      return this.#responseWithTokens(res, userData, next);
    } catch (error) {
      return HttpResponser.errorJson(res, { message: 'Invalid token' }, 401);
    }
  };

  #responseWithTokens = async (
    res: Response,
    userData,
    next?: NextFunction,
  ) => {
    const accessToken = await authService.generateToken(
      userData,
      process.env.JWT_EXPIRES_IN || '4h',
    );
    res.setHeader('Authorization', accessToken);

    if (!next) {
      // If next is not defined, then it means that the request is a login request, so we need to send the refresh token
      const refreshToken = await authService.generateToken(
        { id: userData.id, remember: userData.remember },
        userData.remember ? '365d' : process.env.JWT_REFRESH_EXPIRES_IN || '8h',
      );

      // Send RefreshToken as HttpOnly Secure cookie
      const maxAge = userData.remember
        ? 365 * 24 * 60 * 60 * 1000 // 365 days in milliseconds
        : 8 * 60 * 60 * 1000; // 8 hours in milliseconds

      // Cookie configuration
      // Development: Use proxy so frontend serves from same origin (localhost:4200)
      // Production: HTTPS with strict sameSite
      const cookieOptions: CookieOptions = {
        httpOnly: true,
        maxAge: maxAge,
        path: '/',
      };

      if (process.env.NODE_ENV === 'production') {
        // Production: secure cookie with strict sameSite
        cookieOptions.secure = true;
        cookieOptions.sameSite = 'strict';
      } else {
        // Development: lax works because proxy makes it same-origin
        cookieOptions.secure = false;
        cookieOptions.sameSite = 'lax';
      }

      res.cookie('refreshToken', refreshToken, cookieOptions);

      return HttpResponser.successEmpty(res);
    }

    next();
  };
}
const authController = new AuthController();
export default authController;
