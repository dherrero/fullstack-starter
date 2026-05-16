import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcrypt';
import { User } from '@api/models';
import authService from './auth.service';

vi.mock('@api/models', () => ({
  User: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

describe('AuthService (internal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HASH_SALT_ROUNDS = '10';
  });

  describe('validateCredentials', () => {
    it('returns the user when password matches', async () => {
      const mockUser = {
        id: 1,
        email: 'a@b.com',
        password: 'hashed',
        permissions: ['ADMIN'],
      };
      vi.mocked(User.findOne).mockResolvedValue(mockUser as never);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.validateCredentials('a@b.com', 'plain');

      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
      expect(result).toEqual(mockUser);
    });

    it('throws when user is not found', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);
      await expect(
        authService.validateCredentials('ghost@b.com', 'x'),
      ).rejects.toThrow('Email or password incorrect.');
    });

    it('throws when password mismatch', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        password: 'hashed',
      } as never);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        authService.validateCredentials('a@b.com', 'bad'),
      ).rejects.toThrow('Email or password incorrect.');
    });
  });

  describe('hashPassword', () => {
    it('delegates to bcrypt.hash with HASH_SALT_ROUNDS env', async () => {
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed' as never);

      const result = await authService.hashPassword('pwd');

      expect(bcrypt.hash).toHaveBeenCalledWith('pwd', '10');
      expect(result).toBe('hashed');
    });
  });
});
