import { beforeEach, describe, expect, it } from 'vitest';
import tokenService from './token.service';

describe('TokenService', () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'gateway-access-secret';
    process.env.JWT_REFRESH_SECRET = 'gateway-refresh-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '8h';
  });

  describe('access tokens', () => {
    it('signs and verifies an access token with typ=access and a jti', async () => {
      const token = await tokenService.generateAccessToken({
        id: 1,
        email: 'a@b.com',
        permissions: [],
      });
      const decoded = tokenService.verifyAccessToken(token);
      expect(decoded.id).toBe(1);
      expect(decoded.email).toBe('a@b.com');
      expect(decoded.typ).toBe('access');
      expect(decoded.jti).toBeDefined();
      expect(decoded.jti.length).toBeGreaterThan(0);
    });

    it('rejects an access token signed with the refresh secret', async () => {
      const token = await tokenService.generateRefreshToken({
        id: 1,
        email: 'a@b.com',
        permissions: [],
      });
      expect(() => tokenService.verifyAccessToken(token)).toThrow();
    });

    it('throws when JWT_ACCESS_SECRET is unset', async () => {
      process.env.JWT_ACCESS_SECRET = '';
      await expect(
        tokenService.generateAccessToken({
          id: 1,
          email: 'a@b.com',
          permissions: [],
        }),
      ).rejects.toThrow('JWT_ACCESS_SECRET');
    });
  });

  describe('refresh tokens', () => {
    it('signs and verifies a refresh token with typ=refresh', async () => {
      const token = await tokenService.generateRefreshToken({
        id: 1,
        email: 'a@b.com',
        permissions: [],
      });
      const decoded = tokenService.verifyRefreshToken(token);
      expect(decoded.typ).toBe('refresh');
      expect(decoded.jti).toBeDefined();
    });

    it('extends expiry to the bounded remember window when remember=true', async () => {
      const token = await tokenService.generateRefreshToken({
        id: 1,
        email: 'a@b.com',
        permissions: [],
        remember: true,
      });
      const decoded = tokenService.verifyRefreshToken(token);
      const lifetime = (decoded.exp ?? 0) - (decoded.iat ?? 0);
      // Default 30d window — much longer than the 8h non-remember token, but no
      // longer a year-long token (T-5).
      expect(lifetime).toBeGreaterThan(8 * 60 * 60);
      expect(lifetime).toBeLessThanOrEqual(31 * 24 * 60 * 60);
      expect(lifetime).toBeGreaterThanOrEqual(29 * 24 * 60 * 60);
    });

    it('rejects a refresh token verified with the access secret', async () => {
      const token = await tokenService.generateAccessToken({
        id: 1,
        email: 'a@b.com',
        permissions: [],
      });
      expect(() => tokenService.verifyRefreshToken(token)).toThrow();
    });
  });

  describe('typ enforcement', () => {
    it('refuses an access token shape signed with the access secret but typ=refresh', async () => {
      const jwt = await import('jsonwebtoken');
      const forged = jwt.default.sign(
        { id: 1, email: 'a@b.com', permissions: [], typ: 'refresh' },
        process.env.JWT_ACCESS_SECRET as string,
        { algorithm: 'HS256', expiresIn: '1h' },
      );
      expect(() => tokenService.verifyAccessToken(forged)).toThrow(
        /Expected access token/,
      );
    });
  });
});
