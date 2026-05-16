import { beforeEach, describe, expect, it } from 'vitest';
import tokenService from './token.service';

describe('TokenService', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'gateway-test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_REFRESH_EXPIRES_IN = '8h';
  });

  it('signs and verifies an access token round-trip', async () => {
    const token = await tokenService.generateAccessToken({
      id: 1,
      email: 'a@b.com',
      permissions: [],
    });
    const decoded = tokenService.verifyToken(token);
    expect(decoded.id).toBe(1);
    expect(decoded.email).toBe('a@b.com');
  });

  it('signs a remember refresh token with extended expiry', async () => {
    const token = await tokenService.generateRefreshToken({
      id: 1,
      remember: true,
    });
    const decoded = tokenService.verifyToken(token);
    expect(decoded.id).toBe(1);
    expect(decoded.exp).toBeDefined();
    // 365d → exp - iat should be ~ 31_536_000
    expect((decoded.exp ?? 0) - (decoded.iat ?? 0)).toBeGreaterThan(
      30 * 24 * 60 * 60,
    );
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await tokenService.generateAccessToken({
      id: 1,
      email: 'a@b.com',
      permissions: [],
    });
    process.env.JWT_SECRET = 'other-secret';
    expect(() => tokenService.verifyToken(token)).toThrow();
  });
});
