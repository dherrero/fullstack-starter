import { userCrudService } from '@api/services';
import { AbstractCrudController } from './abstract-crud.controller';

class UserCrudController extends AbstractCrudController {
  constructor() {
    super(userCrudService);
  }
}

const userCrudController = new UserCrudController();

export default userCrudController;
