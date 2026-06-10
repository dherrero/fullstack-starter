import HttpResponser from '@api/adapters/http/http.responser';
import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

type Source = 'body' | 'query' | 'params';

const formatIssues = (error: ZodError) =>
  error.issues
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');

/**
 * Validates `req[source]` against a Zod schema before the controller runs.
 * On failure it short-circuits with a 400 (no stack/SQL leaked). On success it
 * exposes the parsed, type-coerced, stripped value:
 *   - body/params are writable, so they are replaced in place.
 *   - query is a getter in Express 5, so the parsed value is stored on
 *     `res.locals.<source>` (read it from there in the controller).
 *
 * Schemas are the single source of truth in `@dto`.
 */
export const validate =
  (schema: ZodType, source: Source = 'body') =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return HttpResponser.errorJson(
        res,
        { message: `Validation failed — ${formatIssues(result.error)}` },
        400,
      );
    }
    res.locals[source] = result.data;
    try {
      // body and params are writable; query is a read-only getter in Express 5.
      (req as Record<Source, unknown>)[source] = result.data;
    } catch {
      /* query getter — consumers read res.locals.query instead */
    }
    next();
  };
