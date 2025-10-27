import HttpResponser from '@back/adapters/http/http.responser';
import { AbstractCrudService } from '@back/services/abstract-crud.service';

export abstract class AbstractCrudController {
  protected service: AbstractCrudService;

  constructor(service: AbstractCrudService) {
    this.service = service;
  }

  getAllPaged = async (req, res) => {
    try {
      const { page, limit } = req.query;
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
      await this.service.put(req.params.id, req.body);
      const updated = await this.service.getById({ id: req.params.id });
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
