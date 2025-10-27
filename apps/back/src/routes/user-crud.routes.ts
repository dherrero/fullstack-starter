import { authController, userCrudController } from '@back/controllers';
import { Permission } from '@dto';
import { Router } from 'express';

const userCrudRouter = Router();

userCrudRouter.get(
  '/',
  authController.hasPermission(Permission.ADMIN),
  userCrudController.getAll
);
userCrudRouter.get(
  '/paged',
  authController.hasPermission(Permission.ADMIN),
  userCrudController.getAllPaged
);
userCrudRouter.get(
  '/:id',
  authController.hasPermission(Permission.ADMIN),
  userCrudController.getById
);
userCrudRouter.post(
  '/',
  authController.hasPermission(Permission.ADMIN),
  userCrudController.post
);
userCrudRouter.put(
  '/:id',
  authController.hasPermission(Permission.ADMIN),
  userCrudController.put
);
userCrudRouter.delete(
  '/:id',
  authController.hasPermission(Permission.ADMIN),
  userCrudController.delete
);

export default userCrudRouter;
