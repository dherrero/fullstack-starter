import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefreshTokenFamily } from '@api/models';
import refreshTokenFamilyService from './refresh-token-family.service';

vi.mock('@api/models', () => ({
  RefreshTokenFamily: {
    create: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
  },
}));

const FAMILY = '11111111-1111-1111-1111-111111111111';
const JTI = '22222222-2222-2222-2222-222222222222';

describe('RefreshTokenFamilyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('record', () => {
    it('persists a new family row', async () => {
      vi.mocked(RefreshTokenFamily.create).mockResolvedValue({} as never);
      await refreshTokenFamilyService.record({
        userId: 1,
        familyId: FAMILY,
        jti: JTI,
      });
      expect(RefreshTokenFamily.create).toHaveBeenCalledWith({
        userId: 1,
        familyId: FAMILY,
        jti: JTI,
        parentJti: null,
        used: false,
        revokedAt: null,
      });
    });
  });

  describe('rotate', () => {
    it('returns rotated and marks the row used on first valid use', async () => {
      const row = {
        userId: 1,
        familyId: FAMILY,
        jti: JTI,
        used: false,
        revokedAt: null,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(RefreshTokenFamily.findOne).mockResolvedValue(row as never);

      const result = await refreshTokenFamilyService.rotate({ jti: JTI });

      expect(result).toEqual({
        status: 'rotated',
        userId: 1,
        familyId: FAMILY,
        parentJti: JTI,
      });
      expect(row.used).toBe(true);
      expect(row.save).toHaveBeenCalled();
    });

    it('returns not-found when the jti is unknown', async () => {
      vi.mocked(RefreshTokenFamily.findOne).mockResolvedValue(null);
      const result = await refreshTokenFamilyService.rotate({ jti: JTI });
      expect(result.status).toBe('not-found');
    });

    it('returns family-revoked when revokedAt is set', async () => {
      vi.mocked(RefreshTokenFamily.findOne).mockResolvedValue({
        userId: 1,
        familyId: FAMILY,
        jti: JTI,
        used: false,
        revokedAt: new Date(),
        save: vi.fn(),
      } as never);
      const result = await refreshTokenFamilyService.rotate({ jti: JTI });
      expect(result.status).toBe('family-revoked');
    });

    it('detects reuse, revokes whole family, and returns reused-revoked', async () => {
      vi.mocked(RefreshTokenFamily.findOne).mockResolvedValue({
        userId: 1,
        familyId: FAMILY,
        jti: JTI,
        used: true,
        revokedAt: null,
        save: vi.fn(),
      } as never);
      vi.mocked(RefreshTokenFamily.update).mockResolvedValue([3] as never);

      const result = await refreshTokenFamilyService.rotate({ jti: JTI });

      expect(result.status).toBe('reused-revoked');
      expect(RefreshTokenFamily.update).toHaveBeenCalled();
      const [updateArgs, options] = vi.mocked(RefreshTokenFamily.update).mock
        .calls[0];
      expect(updateArgs).toEqual(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect((options as { where: { familyId: string } }).where.familyId).toBe(
        FAMILY,
      );
    });
  });

  describe('revokeByJti', () => {
    it('revokes the entire family of the given jti', async () => {
      vi.mocked(RefreshTokenFamily.findOne).mockResolvedValue({
        userId: 1,
        familyId: FAMILY,
        jti: JTI,
      } as never);
      vi.mocked(RefreshTokenFamily.update).mockResolvedValue([2] as never);

      const result = await refreshTokenFamilyService.revokeByJti(JTI);

      expect(result).toEqual({
        status: 'family-revoked',
        userId: 1,
        familyId: FAMILY,
      });
      expect(RefreshTokenFamily.update).toHaveBeenCalled();
    });

    it('returns not-found when jti has no row', async () => {
      vi.mocked(RefreshTokenFamily.findOne).mockResolvedValue(null);
      const result = await refreshTokenFamilyService.revokeByJti('missing');
      expect(result.status).toBe('not-found');
    });
  });
});
