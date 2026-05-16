import type { NextFunction, Request, Response } from 'express';

import type { Permission } from '@dto';
import {
  INTERNAL_AUTH_HEADER,
  INTERNAL_REQUEST_ID_HEADER,
  InternalScope,
} from './internal-auth.constants';
import { verifyInternalAuth } from './internal-auth.signer';
import type { InternalAuthClaims } from './internal-auth.types';

export interface RequireInternalAuthOptions {
  secret: string;
  issuer?: string;
  audience?: string;
  allowedScopes?: InternalScope[];
  requiredPermissions?: Permission[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      internalAuth?: InternalAuthClaims;
    }
  }
}

/**
 * Express middleware factory. Verifies the `X-Internal-Auth` JWT placed
 * by the gateway, exposes the claims as `res.locals.internalAuth`, and
 * (optionally) enforces scope / permission policies.
 */
export const requireInternalAuth =
  (options: RequireInternalAuthOptions) =>
  (req: Request, res: Response, next: NextFunction) => {
    const token = req.header(INTERNAL_AUTH_HEADER);
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing internal auth header',
        code: 'INTERNAL_AUTH_MISSING',
      });
    }

    try {
      const claims = verifyInternalAuth(token, {
        secret: options.secret,
        issuer: options.issuer,
        audience: options.audience,
      });

      if (
        options.allowedScopes &&
        !options.allowedScopes.includes(claims.scope)
      ) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `Scope ${claims.scope} is not allowed on this route`,
          code: 'INTERNAL_AUTH_SCOPE_DENIED',
        });
      }

      if (
        options.requiredPermissions &&
        !hasAnyPermission(claims.permissions, options.requiredPermissions)
      ) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'Insufficient permissions',
          code: 'INTERNAL_AUTH_PERMISSION_DENIED',
        });
      }

      res.locals.internalAuth = claims;
      res.setHeader(INTERNAL_REQUEST_ID_HEADER, claims.requestId);
      return next();
    } catch {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid internal auth token',
        code: 'INTERNAL_AUTH_INVALID',
      });
    }
  };

const hasAnyPermission = (
  userPermissions: Permission[],
  required: Permission[],
): boolean => required.some((perm) => userPermissions.includes(perm));
