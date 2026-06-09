import { describe, expect, it, vi } from 'vitest';
import { AbstractCrudController } from './abstract-crud.controller';

class TestController extends AbstractCrudController {
  constructor(service: never) {
    super(service);
  }
}

const makeRes = () => {
  const res: Record<string, unknown> = { locals: {} };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as never;
};

describe('AbstractCrudController', () => {
  describe('getAllPaged', () => {
    it('clamps invalid pagination to sane defaults', async () => {
      const service = {
        getAllPaged: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
      };
      const ctrl = new TestController(service as never);

      await ctrl.getAllPaged(
        { query: { page: 'abc', limit: '99999' } } as never,
        makeRes(),
      );

      // Bad page -> 1; limit clamped to <=100 falls back to default 10 here.
      expect(service.getAllPaged).toHaveBeenCalledWith(1, 10);
    });

    it('honours valid pagination', async () => {
      const service = {
        getAllPaged: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
      };
      const ctrl = new TestController(service as never);

      await ctrl.getAllPaged(
        { query: { page: '2', limit: '25' } } as never,
        makeRes(),
      );

      expect(service.getAllPaged).toHaveBeenCalledWith(2, 25);
    });
  });

  describe('put', () => {
    it('404s and does not update a soft-deleted/absent row', async () => {
      const service = {
        getById: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
      };
      const ctrl = new TestController(service as never);
      const res = makeRes();

      await ctrl.put({ params: { id: '7' }, body: {} } as never, res);

      expect(service.getById).toHaveBeenCalledWith({ id: '7', deleted: false });
      expect(service.put).not.toHaveBeenCalled();
      expect(
        (res as { status: ReturnType<typeof vi.fn> }).status,
      ).toHaveBeenCalledWith(404);
    });

    it('updates and reads back an existing row with deleted:false', async () => {
      const service = {
        getById: vi
          .fn()
          .mockResolvedValueOnce({ id: 7 })
          .mockResolvedValueOnce({ id: 7, name: 'new' }),
        put: vi.fn().mockResolvedValue([1]),
      };
      const ctrl = new TestController(service as never);

      await ctrl.put(
        { params: { id: '7' }, body: { name: 'new' } } as never,
        makeRes(),
      );

      expect(service.put).toHaveBeenCalledWith('7', { name: 'new' });
      expect(service.getById).toHaveBeenLastCalledWith({
        id: '7',
        deleted: false,
      });
    });
  });
});
