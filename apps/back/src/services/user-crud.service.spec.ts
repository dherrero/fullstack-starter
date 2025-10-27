import { describe, it, expect, vi, beforeEach } from 'vitest';
import userCrudService from './user-crud.service';
import { User } from '@back/models';
import { Permission } from '@dto';
import authService from './auth.service';
import { Op } from 'sequelize';

// Mock dependencies
vi.mock('@back/models', () => ({
  User: {
    create: vi.fn(),
    findByPk: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    sequelize: {
      literal: vi.fn((value) => value),
    },
  },
}));

vi.mock('./auth.service', () => ({
  default: {
    hashPassword: vi.fn(),
  },
}));

describe('UserCrudService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('post', () => {
    it('should create a new user with hashed password', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        password: 'plainPassword123',
        permissions: [Permission.USER],
      };

      const hashedPassword = '$2b$10$hashedPassword';
      const createdUser = {
        id: 1,
        ...userData,
        password: hashedPassword,
      };

      vi.mocked(authService.hashPassword).mockResolvedValue(hashedPassword);
      vi.mocked(User.create).mockResolvedValue(createdUser as any);

      // Act
      const result = await userCrudService.post(userData);

      // Assert
      expect(authService.hashPassword).toHaveBeenCalledWith('plainPassword123');
      expect(User.create).toHaveBeenCalledWith({
        ...userData,
        password: hashedPassword,
      });
      expect(result).toEqual(createdUser);
    });

    it('should create a user without password hashing if no password provided', async () => {
      // Arrange
      const userData = {
        email: 'newuser@example.com',
        permissions: [Permission.USER],
      };

      const createdUser = { id: 1, ...userData };

      vi.mocked(User.create).mockResolvedValue(createdUser as any);

      // Act
      const result = await userCrudService.post(userData);

      // Assert
      expect(authService.hashPassword).not.toHaveBeenCalled();
      expect(User.create).toHaveBeenCalledWith(userData);
      expect(result).toEqual(createdUser);
    });
  });

  describe('put', () => {
    it('should update user with hashed password', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        email: 'updated@example.com',
        password: 'newPassword123',
        permissions: [Permission.USER],
      };

      const currentUser = {
        id: userId,
        email: 'old@example.com',
        permissions: [Permission.USER],
      };

      const hashedPassword = '$2b$10$newHashedPassword';

      vi.mocked(User.findByPk).mockResolvedValue(currentUser as any);
      vi.mocked(authService.hashPassword).mockResolvedValue(hashedPassword);
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      const result = await userCrudService.put(userId, updateData);

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(authService.hashPassword).toHaveBeenCalledWith('newPassword123');
      expect(User.update).toHaveBeenCalledWith(
        { ...updateData, password: hashedPassword },
        { where: { id: userId } }
      );
      expect(result).toEqual([1]);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 999;
      const updateData = { email: 'updated@example.com' };

      vi.mocked(User.findByPk).mockResolvedValue(null);

      // Act & Assert
      await expect(userCrudService.put(userId, updateData)).rejects.toThrow(
        'Usuario no encontrado'
      );
    });

    it('should not hash password if password is empty string', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        email: 'updated@example.com',
        password: '   ',
        permissions: [Permission.USER],
      };

      const currentUser = {
        id: userId,
        permissions: [Permission.USER],
      };

      vi.mocked(User.findByPk).mockResolvedValue(currentUser as any);
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      await userCrudService.put(userId, updateData);

      // Assert
      expect(authService.hashPassword).not.toHaveBeenCalled();
      expect(User.update).toHaveBeenCalledWith(
        { email: 'updated@example.com', permissions: [Permission.USER] },
        { where: { id: userId } }
      );
    });

    it('should allow removing ADMIN permission if other admins exist', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        email: 'user@example.com',
        permissions: [Permission.USER],
      };

      const currentUser = {
        id: userId,
        permissions: [Permission.ADMIN],
      };

      vi.mocked(User.findByPk).mockResolvedValue(currentUser as any);
      vi.mocked(User.count).mockResolvedValue(2); // Other admins exist
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      const result = await userCrudService.put(userId, updateData);

      // Assert
      expect(User.count).toHaveBeenCalledWith({
        where: {
          permissions: { [Op.contains]: [Permission.ADMIN] },
          id: { [Op.ne]: userId },
          deleted: false,
        },
      });
      expect(result).toEqual([1]);
    });

    it('should throw error when removing last ADMIN permission', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        email: 'user@example.com',
        permissions: [Permission.USER],
      };

      const currentUser = {
        id: userId,
        permissions: [Permission.ADMIN],
      };

      vi.mocked(User.findByPk).mockResolvedValue(currentUser as any);
      vi.mocked(User.count).mockResolvedValue(0); // No other admins

      // Act & Assert
      await expect(userCrudService.put(userId, updateData)).rejects.toThrow(
        'No se puede quitar el permiso de ADMIN. Debe existir al menos un usuario con permisos de administrador en el sistema.'
      );
    });

    it('should not check admin count when updating non-admin user', async () => {
      // Arrange
      const userId = 1;
      const updateData = {
        email: 'user@example.com',
        permissions: [Permission.USER],
      };

      const currentUser = {
        id: userId,
        permissions: [Permission.USER],
      };

      vi.mocked(User.findByPk).mockResolvedValue(currentUser as any);
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      await userCrudService.put(userId, updateData);

      // Assert
      expect(User.count).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should soft delete a non-admin user', async () => {
      // Arrange
      const userId = 1;
      const user = {
        id: userId,
        email: 'user@example.com',
        permissions: [Permission.USER],
      };

      vi.mocked(User.findByPk).mockResolvedValue(user as any);
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      const result = await userCrudService.delete(userId);

      // Assert
      expect(User.findByPk).toHaveBeenCalledWith(userId);
      expect(User.update).toHaveBeenCalledWith(
        {
          deleted: true,
          deletedAt: 'CURRENT_TIMESTAMP',
        },
        { where: { id: userId } }
      );
      expect(result).toEqual([1]);
    });

    it('should throw error when user not found', async () => {
      // Arrange
      const userId = 999;

      vi.mocked(User.findByPk).mockResolvedValue(null);

      // Act & Assert
      await expect(userCrudService.delete(userId)).rejects.toThrow(
        'Usuario no encontrado'
      );
    });

    it('should allow deleting admin user if other admins exist', async () => {
      // Arrange
      const userId = 1;
      const user = {
        id: userId,
        email: 'admin@example.com',
        permissions: [Permission.ADMIN],
      };

      vi.mocked(User.findByPk).mockResolvedValue(user as any);
      vi.mocked(User.count).mockResolvedValue(2); // Other admins exist
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      const result = await userCrudService.delete(userId);

      // Assert
      expect(User.count).toHaveBeenCalledWith({
        where: {
          permissions: { [Op.contains]: [Permission.ADMIN] },
          id: { [Op.ne]: userId },
          deleted: false,
        },
      });
      expect(result).toEqual([1]);
    });

    it('should throw error when deleting last admin user', async () => {
      // Arrange
      const userId = 1;
      const user = {
        id: userId,
        email: 'admin@example.com',
        permissions: [Permission.ADMIN],
      };

      vi.mocked(User.findByPk).mockResolvedValue(user as any);
      vi.mocked(User.count).mockResolvedValue(0); // No other admins

      // Act & Assert
      await expect(userCrudService.delete(userId)).rejects.toThrow(
        'No se puede eliminar el usuario. Debe existir al menos un usuario con permisos de administrador en el sistema.'
      );
    });

    it('should not check admin count when deleting non-admin user', async () => {
      // Arrange
      const userId = 1;
      const user = {
        id: userId,
        email: 'user@example.com',
        permissions: [Permission.USER],
      };

      vi.mocked(User.findByPk).mockResolvedValue(user as any);
      vi.mocked(User.update).mockResolvedValue([1] as any);

      // Act
      await userCrudService.delete(userId);

      // Assert
      expect(User.count).not.toHaveBeenCalled();
    });
  });
});
