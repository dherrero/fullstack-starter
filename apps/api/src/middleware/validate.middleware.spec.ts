import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate } from './validate.middleware';

const schema = z
  .object({ email: z.string().email(), name: z.string().min(1) })
  .strict();

const makeRes = () => {
  const res: Record<string, unknown> = { locals: {} };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res as never;
};

describe('validate middleware', () => {
  it('calls next and exposes parsed body on success', () => {
    const req = { body: { email: 'a@b.com', name: 'Ann' } } as never;
    const res = makeRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((req as { body: unknown }).body).toEqual({
      email: 'a@b.com',
      name: 'Ann',
    });
  });

  it('rejects unknown keys (mass-assignment) with 400', () => {
    const req = {
      body: { email: 'a@b.com', name: 'Ann', permissions: ['ADMIN'] },
    } as never;
    const res = makeRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(
      (res as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(400);
  });

  it('rejects invalid payloads with 400 and does not call next', () => {
    const req = { body: { email: 'not-an-email', name: '' } } as never;
    const res = makeRes();
    const next = vi.fn();

    validate(schema)(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(
      (res as { status: ReturnType<typeof vi.fn> }).status,
    ).toHaveBeenCalledWith(400);
  });

  it('stores parsed query on res.locals when req.query is a getter', () => {
    const querySchema = z.object({ page: z.coerce.number().int().min(1) });
    const req = {} as Record<string, unknown>;
    Object.defineProperty(req, 'query', {
      get: () => ({ page: '3' }),
      configurable: true,
    });
    const res = makeRes();
    const next = vi.fn();

    validate(querySchema, 'query')(req as never, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect((res as { locals: { query: unknown } }).locals.query).toEqual({
      page: 3,
    });
  });
});
