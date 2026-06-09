import { userCrudController } from '@api/controllers';
import { validate } from '@api/middleware';
import { Permission, userCreateSchema, userUpdateSchema } from '@dto';
import { requireInternalAuth, InternalScope } from '@internal-auth';
import { Router } from 'express';

const userCrudRouter = Router();
const requireAdmin = requireInternalAuth({
  publicKey: process.env.INTERNAL_JWT_PUBLIC_KEY ?? '',
  allowedScopes: [InternalScope.USER_REQUEST],
  requiredPermissions: [Permission.ADMIN],
});

userCrudRouter.get('/', requireAdmin, userCrudController.getAll);
userCrudRouter.get('/paged', requireAdmin, userCrudController.getAllPaged);
userCrudRouter.get('/:id', requireAdmin, userCrudController.getById);
userCrudRouter.post(
  '/',
  requireAdmin,
  validate(userCreateSchema),
  userCrudController.post,
);
userCrudRouter.put(
  '/:id',
  requireAdmin,
  validate(userUpdateSchema),
  userCrudController.put,
);
userCrudRouter.delete('/:id', requireAdmin, userCrudController.delete);

export default userCrudRouter;
