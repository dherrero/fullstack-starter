import HttpResponser from '@api/adapters/http/http.responser';
import { AbstractCrudService } from '@api/services/abstract-crud.service';
import { paginationQuerySchema } from '@dto';

export abstract class AbstractCrudController {
  protected service: AbstractCrudService;

  constructor(service: AbstractCrudService) {
    this.service = service;
  }

  getAllPaged = async (req, res) => {
    try {
      // Parse + clamp pagination (page>=1, 1<=limit<=100) so NaN/negative or
      // huge limits can't skew the offset or pull the whole table (DoS). Bad
      // input falls back to sane defaults rather than erroring. Uses the value a
      // validate('query') middleware may have placed on res.locals.
      const parsed = paginationQuerySchema.safeParse(
        res.locals.query ?? req.query,
      );
      const { page, limit } = parsed.success
        ? parsed.data
        : { page: 1, limit: 10 };
      const data = await this.service.getAllPaged(page, limit);
      return HttpResponser.successJson(res, data);
    } catch (error) {
      return HttpResponser.errorJson(res, error);
    }
  };

  getAll = async (_, res) => {
    try {
      const data = await this.service.getAll();
      return HttpResponser.successJson(res, data);
    } catch (error) {
      return HttpResponser.errorJson(res, error);
    }
  };

  getById = async (req, res) => {
    try {
      const data = await this.service.getById({
        id: req.params.id,
        deleted: false,
      });
      return HttpResponser.successJson(res, data);
    } catch (error) {
      return HttpResponser.errorJson(res, error);
    }
  };

  post = async (req, res) => {
    try {
      const data = await this.service.post(req.body);
      return HttpResponser.successJson(res, data, 201);
    } catch (error) {
      return HttpResponser.errorJson(res, error);
    }
  };

  put = async (req, res) => {
    try {
      // Never read or mutate a soft-deleted row: it must behave as if gone.
      const existing = await this.service.getById({
        id: req.params.id,
        deleted: false,
      });
      if (!existing) {
        return HttpResponser.errorJson(res, { message: 'Not found' }, 404);
      }
      await this.service.put(req.params.id, req.body);
      const updated = await this.service.getById({
        id: req.params.id,
        deleted: false,
      });
      return HttpResponser.successJson(res, updated);
    } catch (error) {
      console.log(error);
      return HttpResponser.errorJson(res, error);
    }
  };

  delete = async (req, res) => {
    try {
      await this.service.delete(req.params.id);
      return HttpResponser.successEmpty(res);
    } catch (error) {
      return HttpResponser.errorJson(res, error);
    }
  };
}
