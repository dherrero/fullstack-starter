import { Response } from 'express';

class HttpResponser {
  static successJson = (res: Response, data: unknown, statusCode = 200) =>
    HttpResponser.#sendJson(res, data, statusCode);

  static successEmpty = (res: Response, statusCode = 200) =>
    HttpResponser.#sendData(res, null, statusCode);

  static errorJson = (
    res: Response,
    error: Record<string, string> | { message?: string },
    statusCode = 500,
  ) =>
    HttpResponser.#sendJson(
      res,
      { error: (error as { message?: string }).message ?? 'Unknown error' },
      statusCode,
    );

  static #sendJson = (res: Response, data: unknown, statusCode: number) =>
    res.status(statusCode).json(data);

  static #sendData = (res: Response, data: unknown, statusCode: number) =>
    res.status(statusCode).send(data);
}

export default HttpResponser;
