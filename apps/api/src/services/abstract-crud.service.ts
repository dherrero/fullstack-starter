/* eslint-disable @typescript-eslint/no-explicit-any */
import sequelize, { ModelStatic } from 'sequelize';

/**
 * Abstract class to be extended by all services
 * provides basic CRUD operations
 */

export abstract class AbstractCrudService {
  protected model: ModelStatic<any>;
  /**
   * Allow-list of attributes a client may write through post/put. When set, it
   * is passed as Sequelize's `fields` option so any extra key in the payload
   * (e.g. `permissions`, `deleted`, `deletedAt`, `id`) is silently ignored,
   * preventing mass-assignment / over-posting privilege escalation. Leave
   * undefined only for internal entities with no client-facing write surface.
   */
  protected readonly writableFields?: string[];

  constructor(model: ModelStatic<any>, writableFields?: string[]) {
    this.model = model;
    this.writableFields = writableFields;
  }

  getAllPaged = async (
    page: number,
    limit: number,
    where: Record<string, any> = { deleted: false },
    excludeColumns?: string[],
  ) => {
    const offset = (page - 1) * limit;
    return await this.model.findAndCountAll({
      attributes: {
        exclude: excludeColumns ?? this.excludeColumns(where.deleted),
      },
      where,
      limit,
      offset,
    });
  };
  getAll = async (
    where: Record<string, any> = { deleted: false },
    excludeColumns?: string[],
  ) =>
    await this.model.findAll({
      attributes: {
        exclude: excludeColumns ?? this.excludeColumns(where.deleted),
      },
      where,
    });

  getById = async (
    where: Record<string, any> = { deleted: false },
    excludeColumns?: string[],
  ) =>
    await this.model.findOne({
      attributes: {
        exclude: excludeColumns ?? this.excludeColumns(where.deleted),
      },
      where,
    });

  post = async (model) =>
    await this.model.create(
      model,
      this.writableFields ? { fields: this.writableFields } : undefined,
    );

  put = async (id: number, data) =>
    await this.model.update(
      { ...data },
      {
        where: { id },
        ...(this.writableFields ? { fields: this.writableFields } : {}),
      },
    );

  delete = async (id: number) =>
    await this.model.update(
      { deleted: true, deletedAt: sequelize.literal('CURRENT_TIMESTAMP') },
      { where: { id } },
    );

  private excludeColumns(showDeleted = false) {
    const excluded = ['password'];
    if (!showDeleted) {
      excluded.push('deleted', 'deletedAt');
    }
    return excluded;
  }
}
