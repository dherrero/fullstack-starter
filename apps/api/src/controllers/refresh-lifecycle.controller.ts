import HttpResponser from '@api/adapters/http/http.responser';
import { authService, refreshTokenFamilyService } from '@api/services';
import type { Request, Response } from 'express';

/**
 * System-to-system endpoints used by the gateway to manage refresh-token
 * families. Protected by `requireInternalAuth` with the dedicated
 * REFRESH_LIFECYCLE scope so only the gateway can call them.
 */
class RefreshLifecycleController {
  record = async (req: Request, res: Response) => {
    try {
      const { userId, familyId, jti, parentJti } = req.body ?? {};
      if (!userId || !familyId || !jti) {
        return HttpResponser.errorJson(
          res,
          { message: 'Missing userId, familyId or jti' },
          400,
        );
      }
      await refreshTokenFamilyService.record({
        userId: Number(userId),
        familyId,
        jti,
        parentJti: parentJti ?? null,
      });
      return HttpResponser.successJson(res, { recorded: true }, 201);
    } catch (err) {
      return HttpResponser.errorJson(res, err as Error);
    }
  };

  rotate = async (req: Request, res: Response) => {
    try {
      const { jti } = req.body ?? {};
      if (!jti) {
        return HttpResponser.errorJson(res, { message: 'Missing jti' }, 400);
      }
      const outcome = await refreshTokenFamilyService.rotate({ jti });
      switch (outcome.status) {
        case 'rotated': {
          // Re-read the user from the authoritative source on every rotation so
          // revoked/downgraded permissions (and soft-deleted accounts) take
          // effect immediately, instead of carrying stale claims from the old
          // refresh token forward (T-5). getUser already filters deleted:false.
          const user = await authService.getUser(outcome.userId);
          if (!user) {
            await refreshTokenFamilyService.revokeFamily(outcome.familyId);
            return HttpResponser.errorJson(
              res,
              { message: 'User no longer active' },
              401,
            );
          }
          return HttpResponser.successJson(res, {
            status: outcome.status,
            userId: outcome.userId,
            familyId: outcome.familyId,
            parentJti: outcome.parentJti,
            email: user.email,
            permissions: user.permissions,
          });
        }
        case 'reused-revoked':
        case 'family-revoked':
          return HttpResponser.errorJson(
            res,
            {
              message: `Refresh chain ${outcome.status}`,
            },
            401,
          );
        case 'not-found':
        default:
          return HttpResponser.errorJson(
            res,
            { message: 'Refresh token not found' },
            401,
          );
      }
    } catch (err) {
      return HttpResponser.errorJson(res, err as Error);
    }
  };

  revoke = async (req: Request, res: Response) => {
    try {
      const { jti, familyId } = req.body ?? {};
      if (jti) {
        const outcome = await refreshTokenFamilyService.revokeByJti(jti);
        return HttpResponser.successJson(res, outcome);
      }
      if (familyId) {
        const affected = await refreshTokenFamilyService.revokeFamily(familyId);
        return HttpResponser.successJson(res, { revoked: affected });
      }
      return HttpResponser.errorJson(
        res,
        { message: 'Missing jti or familyId' },
        400,
      );
    } catch (err) {
      return HttpResponser.errorJson(res, err as Error);
    }
  };
}

const refreshLifecycleController = new RefreshLifecycleController();
export default refreshLifecycleController;
