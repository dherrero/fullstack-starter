import HttpResponser from '@gateway/adapters/http/http.responser';
import { ApiClient } from '@gateway/clients/api.client';
import { tokenService } from '@gateway/services';
import { rememberRefreshMaxAgeMs } from '@gateway/services/token.service';
import { Permission } from '@dto';
import { randomUUID } from 'crypto';
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

interface IssueRefreshOptions {
  user: UserContext & { remember?: boolean };
  familyId: string;
  parentJti?: string;
  requestId: string;
}

const issueRefreshAndRecord = async (
  res: Response,
  options: IssueRefreshOptions,
) => {
  const jti = randomUUID();
  const refreshToken = await tokenService.generateRefreshToken({
    id: options.user.id,
    email: options.user.email,
    permissions: options.user.permissions,
    remember: options.user.remember,
    jti,
  });
  await ApiClient.recordRefresh(
    {
      userId: options.user.id,
      familyId: options.familyId,
      jti,
      parentJti: options.parentJti,
    },
    options.requestId,
  );
  const maxAge = options.user.remember
    ? rememberRefreshMaxAgeMs()
    : 8 * 60 * 60 * 1000;
  res.cookie(REFRESH_COOKIE, refreshToken, buildCookieOptions(maxAge));
};

/**
 * Issue a fresh access token plus (when requested) a refresh token. The
 * refresh JWT is recorded in the api's refresh-token-family table so it
 * can later be rotated and so reuse can be detected.
 */
export const respondWithTokens = async (
  res: Response,
  userData: UserContext & { remember?: boolean },
  options:
    | { issueRefreshCookie: true; requestId: string }
    | { issueRefreshCookie?: false } = {},
) => {
  await writeAccessTokenHeader(res, {
    id: userData.id,
    email: userData.email,
    permissions: userData.permissions,
  });

  if (options.issueRefreshCookie) {
    await issueRefreshAndRecord(res, {
      user: userData,
      familyId: randomUUID(),
      requestId: options.requestId,
    });
  }
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(REFRESH_COOKIE, buildCookieOptions());
};

/**
 * Best-effort revoke of the refresh family attached to the current
 * cookie, used by /logout. Failure is swallowed so a logout always
 * succeeds even if the api is momentarily unreachable.
 */
export const revokeCurrentRefreshFamily = async (
  req: Request,
  requestId: string,
): Promise<void> => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE];
  if (!refreshToken) return;
  try {
    const decoded = tokenService.verifyRefreshToken(refreshToken);
    if (decoded.jti) {
      await ApiClient.revokeRefresh({ jti: decoded.jti }, requestId);
    }
  } catch {
    /* expired / invalid refresh — nothing to revoke */
  }
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
      const decoded = tokenService.verifyAccessToken(accessToken);
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

  let decoded;
  try {
    decoded = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    return HttpResponser.errorJson(res, { message: 'Invalid token' }, 401);
  }

  const requestId = randomUUID();
  try {
    const rotation = await ApiClient.rotateRefresh(decoded.jti, requestId);
    // Use the permissions/email the api just re-read from the user record, NOT
    // the (possibly stale) claims embedded in the old refresh token (T-5).
    const user: UserContext = {
      id: rotation.userId,
      email: rotation.email ?? decoded.email,
      permissions: rotation.permissions ?? [],
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
    await issueRefreshAndRecord(res, {
      user: { ...user, remember: decoded.remember },
      familyId: rotation.familyId,
      parentJti: rotation.parentJti,
      requestId,
    });
    return next();
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode ?? 401;
    // Reuse-detected / chain revoked: also clear the cookie so the
    // attacker (and the legit user) is forced back through /login.
    clearRefreshCookie(res);
    return HttpResponser.errorJson(
      res,
      { message: 'Refresh rejected' },
      statusCode,
    );
  }
};
