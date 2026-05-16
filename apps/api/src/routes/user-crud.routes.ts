import { userCrudController } from '@api/controllers';
import { Permission } from '@dto';
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
userCrudRouter.post('/', requireAdmin, userCrudController.post);
userCrudRouter.put('/:id', requireAdmin, userCrudController.put);
userCrudRouter.delete('/:id', requireAdmin, userCrudController.delete);

export default userCrudRouter;
