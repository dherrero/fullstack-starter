import { User } from '@back/models';
import { Permission } from '@dto';
import { Op } from 'sequelize';
import { AbstractCrudService } from './abstract-crud.service';
import authService from './auth.service';

class UserCrudService extends AbstractCrudService {
  constructor() {
    super(User);
  }

  post = async (userData) => {
    if (userData.password) {
      userData.password = await authService.hashPassword(userData.password);
    }
    return await this.model.create(userData);
  };

  put = async (id: number, userData) => {
    // Obtener el usuario actual antes de actualizarlo
    const currentUser = await this.model.findByPk(id);
    if (!currentUser) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar si el usuario actual es ADMIN y va a perder ese permiso
    const currentUserIsAdmin = currentUser.permissions.includes(
      Permission.ADMIN
    );
    const newUserIsAdmin = userData.permissions?.includes(Permission.ADMIN);

    if (currentUserIsAdmin && !newUserIsAdmin) {
      // Contar cuántos usuarios ADMIN existen (excluyendo el usuario actual)
      const adminCount = await this.model.count({
        where: {
          permissions: { [Op.contains]: [Permission.ADMIN] },
          id: { [Op.ne]: id },
          deleted: false,
        },
      });

      if (adminCount === 0) {
        throw new Error(
          'No se puede quitar el permiso de ADMIN. Debe existir al menos un usuario con permisos de administrador en el sistema.'
        );
      }
    }

    if (userData.password && userData.password.trim() !== '') {
      userData.password = await authService.hashPassword(userData.password);
    } else {
      delete userData.password;
    }

    return await this.model.update({ ...userData }, { where: { id } });
  };

  delete = async (id: number) => {
    // Obtener el usuario antes de eliminarlo
    const user = await this.model.findByPk(id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar si el usuario a eliminar es ADMIN
    if (user.permissions.includes(Permission.ADMIN)) {
      // Contar cuántos usuarios ADMIN existen (excluyendo el usuario actual)
      const adminCount = await this.model.count({
        where: {
          permissions: { [Op.contains]: [Permission.ADMIN] },
          id: { [Op.ne]: id },
          deleted: false,
        },
      });

      if (adminCount === 0) {
        throw new Error(
          'No se puede eliminar el usuario. Debe existir al menos un usuario con permisos de administrador en el sistema.'
        );
      }
    }

    return await this.model.update(
      {
        deleted: true,
        deletedAt: this.model.sequelize.literal('CURRENT_TIMESTAMP'),
      },
      { where: { id } }
    );
  };
}

const userCrudService = new UserCrudService();

export default userCrudService;
