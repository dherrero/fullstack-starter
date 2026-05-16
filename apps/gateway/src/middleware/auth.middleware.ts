import HttpResponser from '@gateway/adapters/http/http.responser';
import { tokenService } from '@gateway/services';
import { Permission } from '@dto';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import { TokenExpiredError } from 'jsonwebtoken';

const REFRESH_COOKIE = 'refreshToken';

export interface UserContext {
  id: number;
  email: string;
  permissions: Permission[];
}

const buildCookieOptions = (maxAgeMs?: number): CookieOptions => {
  const options: CookieOptions = { httpOnly: true, path: '/' };
  if (maxAgeMs !== undefined) options.maxAge = maxAgeMs;
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
    options.sameSite = 'strict';
  } else {
    options.secure = false;
    options.sameSite = 'lax';
  }
  return options;
};

const hasAnyPermission = (
  userPermissions: Permission[] | undefined,
  required: Permission | Permission[],
): boolean => {
  if (!Array.isArray(userPermissions)) return false;
  return Array.isArray(required)
    ? required.some((p) => userPermissions.includes(p))
    : userPermissions.includes(required);
};

const writeAccessTokenHeader = async (res: Response, user: UserContext) => {
  const accessToken = await tokenService.generateAccessToken(user);
  res.setHeader('Authorization', accessToken);
};

/**
 * Issue a fresh access token. When `issueRefreshCookie` is true a new
 * refresh JWT — carrying the full user context — is placed in the
 * HttpOnly cookie, so the gateway can rotate access tokens without ever
 * touching the database.
 */
export const respondWithTokens = async (
  res: Response,
  userData: UserContext & { remember?: boolean },
  options: { issueRefreshCookie?: boolean } = {},
) => {
  await writeAccessTokenHeader(res, {
    id: userData.id,
    email: userData.email,
    permissions: userData.permissions,
  });

  if (options.issueRefreshCookie) {
    const refreshToken = await tokenService.generateRefreshToken({
      id: userData.id,
      email: userData.email,
      permissions: userData.permissions,
      remember: userData.remember,
    });
    const maxAge = userData.remember
      ? 365 * 24 * 60 * 60 * 1000
      : 8 * 60 * 60 * 1000;
    res.cookie(REFRESH_COOKIE, refreshToken, buildCookieOptions(maxAge));
  }
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, buildCookieOptions());
};

/**
 * Verify the access token (or transparently rotate it via the refresh
 * cookie) and place the resolved user claims onto `res.locals.user`.
 * Subsequent middleware reads from there to inject `X-Internal-Auth`
 * before proxying the request to the api service.
 */
export const hasPermission =
  (requiredPermission?: Permission | Permission[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next();

    const accessToken = req.header('Authorization');
    const refreshToken = req.cookies?.[REFRESH_COOKIE];

    if (!refreshToken) {
      return HttpResponser.errorJson(
        res,
        { message: 'Access denied: no refresh token' },
        401,
      );
    }

    if (!accessToken) {
      return refreshAndContinue(req, res, next, requiredPermission);
    }

    try {
      const decoded = tokenService.verifyToken(accessToken);
      if (
        requiredPermission &&
        !hasAnyPermission(decoded.permissions, requiredPermission)
      ) {
        return HttpResponser.errorJson(
          res,
          { message: 'Access denied: insufficient permissions' },
          403,
        );
      }
      res.locals.user = {
        id: decoded.id,
        email: decoded.email,
        permissions: decoded.permissions ?? [],
      };
      return next();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        return refreshAndContinue(req, res, next, requiredPermission);
      }
      return HttpResponser.errorJson(res, { message: 'Invalid token' }, 401);
    }
  };

const refreshAndContinue = async (
  req: Request,
  res: Response,
  next: NextFunction,
  requiredPermission?: Permission | Permission[],
) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) {
    return HttpResponser.errorJson(
      res,
      { message: 'Access denied: no refresh token' },
      401,
    );
  }

  try {
    const decoded = tokenService.verifyToken(refreshToken);
    const user: UserContext = {
      id: decoded.id,
      email: decoded.email,
      permissions: decoded.permissions ?? [],
    };

    if (
      requiredPermission &&
      !hasAnyPermission(user.permissions, requiredPermission)
    ) {
      return HttpResponser.errorJson(
        res,
        { message: 'Access denied: insufficient permissions' },
        403,
      );
    }

    res.locals.user = user;
    await writeAccessTokenHeader(res, user);
    return next();
  } catch {
    return HttpResponser.errorJson(res, { message: 'Invalid token' }, 401);
  }
};
