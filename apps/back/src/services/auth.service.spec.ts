import { describe, it, expect, vi, beforeEach } from 'vitest';
import authService from './auth.service';
import { User } from '@back/models';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock dependencies
vi.mock('@back/models', () => ({
  User: {
    findOne: vi.fn(),
    findByPk: vi.fn(),
  },
}));

vi.mock('bcrypt', () => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    process.env.HASH_SALT_ROUNDS = '10';
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed-password',
        permissions: ['ADMIN'],
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Act
      const result = await authService.login('test@example.com', 'password123');

      // Assert
      expect(User.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        'hashed-password'
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      vi.mocked(User.findOne).mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.login('nonexistent@example.com', 'password123')
      ).rejects.toThrow('Email or password incorrect.');
    });

    it('should throw error when password is invalid', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashed-password',
        permissions: ['ADMIN'],
      };

      vi.mocked(User.findOne).mockResolvedValue(mockUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      // Act & Assert
      await expect(
        authService.login('test@example.com', 'wrong-password')
      ).rejects.toThrow('Email or password incorrect.');
    });
  });

  describe('getUser', () => {
    it('should return user by id', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        permissions: ['ADMIN'],
      };

      vi.mocked(User.findByPk).mockResolvedValue(mockUser as any);

      // Act
      const result = await authService.getUser(1);

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      // Arrange
      vi.mocked(User.findByPk).mockResolvedValue(null);

      // Act
      const result = await authService.getUser(999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', async () => {
      // Arrange
      const payload = { userId: 1, email: 'test@example.com' };
      const expiresIn = '1h';
      const mockToken = 'mock.jwt.token';

      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      // Act
      const result = await authService.generateToken(payload, expiresIn);

      // Assert
      expect(jwt.sign).toHaveBeenCalled();
      const callArgs = vi.mocked(jwt.sign).mock.calls[0];
      expect(callArgs[0]).toEqual(payload);
      expect(callArgs[2]).toEqual({ expiresIn });
      expect(result).toBe(mockToken);
    });

    it('should generate token with different expiration times', async () => {
      // Arrange
      const payload = { userId: 1 };
      const mockToken = 'mock.jwt.token';

      vi.mocked(jwt.sign).mockReturnValue(mockToken as any);

      // Act
      const result = await authService.generateToken(payload, '24h');

      // Assert
      expect(jwt.sign).toHaveBeenCalled();
      const callArgs = vi.mocked(jwt.sign).mock.calls[0];
      expect(callArgs[0]).toEqual(payload);
      expect(callArgs[2]).toEqual({ expiresIn: '24h' });
      expect(result).toBe(mockToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token', () => {
      // Arrange
      const token = 'valid.jwt.token';
      const decodedPayload = { userId: 1, email: 'test@example.com' };

      vi.mocked(jwt.verify).mockReturnValue(decodedPayload as any);

      // Act
      const result = authService.verifyToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalled();
      const callArgs = vi.mocked(jwt.verify).mock.calls[0];
      expect(callArgs[0]).toBe(token);
      expect(result).toEqual(decodedPayload);
    });

    it('should throw error for invalid token', () => {
      // Arrange
      const token = 'invalid.token';
      const error = new Error('Invalid token');

      vi.mocked(jwt.verify).mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => authService.verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('hashPassword', () => {
    it('should hash a password with default salt rounds', async () => {
      // Arrange
      const password = 'mySecretPassword';
      const hashedPassword = '$2b$10$hashedPasswordString';

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);

      // Act
      const result = await authService.hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(password, '10');
      expect(result).toBe(hashedPassword);
    });

    it('should hash a password with custom salt rounds from env', async () => {
      // Arrange
      process.env.HASH_SALT_ROUNDS = '12';
      const password = 'mySecretPassword';
      const hashedPassword = '$2b$12$hashedPasswordString';

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);

      // Act
      const result = await authService.hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(password, '12');
      expect(result).toBe(hashedPassword);
    });

    it('should use default salt rounds when env is not set', async () => {
      // Arrange
      delete process.env.HASH_SALT_ROUNDS;
      const password = 'mySecretPassword';
      const hashedPassword = '$2b$10$hashedPasswordString';

      vi.mocked(bcrypt.hash).mockResolvedValue(hashedPassword as never);

      // Act
      const result = await authService.hashPassword(password);

      // Assert
      expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      expect(result).toBe(hashedPassword);
    });
  });
});
