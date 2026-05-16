import { RefreshTokenFamily } from '@api/models';
import { Op } from 'sequelize';

export interface RecordRefreshInput {
  userId: number;
  familyId: string;
  jti: string;
  parentJti?: string | null;
}

export interface RotateRefreshInput {
  jti: string;
}

export type RotateOutcome =
  | { status: 'rotated'; userId: number; familyId: string; parentJti: string }
  | { status: 'reused-revoked'; userId: number; familyId: string }
  | { status: 'not-found' }
  | { status: 'family-revoked'; userId: number; familyId: string };

/**
 * Service in charge of refresh-token lifecycle and reuse detection.
 *
 *   - Every refresh JWT minted by the gateway is recorded here.
 *   - Rotation marks the presented jti as used and emits a fresh row in
 *     the same family. The gateway never directly touches the DB.
 *   - If a jti is presented again after rotation, the whole family is
 *     revoked: stolen refresh tokens cannot outlive a single use.
 */
class RefreshTokenFamilyService {
  record = async ({ userId, familyId, jti, parentJti }: RecordRefreshInput) => {
    return RefreshTokenFamily.create({
      userId,
      familyId,
      jti,
      parentJti: parentJti ?? null,
      used: false,
      revokedAt: null,
    });
  };

  rotate = async ({ jti }: RotateRefreshInput): Promise<RotateOutcome> => {
    const row = await RefreshTokenFamily.findOne({ where: { jti } });
    if (!row) return { status: 'not-found' };

    if (row.revokedAt !== null) {
      return {
        status: 'family-revoked',
        userId: row.userId,
        familyId: row.familyId,
      };
    }

    if (row.used) {
      await this.revokeFamily(row.familyId);
      return {
        status: 'reused-revoked',
        userId: row.userId,
        familyId: row.familyId,
      };
    }

    row.used = true;
    await row.save();
    return {
      status: 'rotated',
      userId: row.userId,
      familyId: row.familyId,
      parentJti: row.jti,
    };
  };

  revokeFamily = async (familyId: string): Promise<number> => {
    const [affected] = await RefreshTokenFamily.update(
      { revokedAt: new Date() },
      {
        where: {
          familyId,
          revokedAt: { [Op.is]: null },
        },
      },
    );
    return affected;
  };

  revokeByJti = async (jti: string): Promise<RotateOutcome> => {
    const row = await RefreshTokenFamily.findOne({ where: { jti } });
    if (!row) return { status: 'not-found' };
    await this.revokeFamily(row.familyId);
    return {
      status: 'family-revoked',
      userId: row.userId,
      familyId: row.familyId,
    };
  };
}

const refreshTokenFamilyService = new RefreshTokenFamilyService();
export default refreshTokenFamilyService;
