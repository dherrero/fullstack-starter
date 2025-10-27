import { Response } from 'express';

class HttpResponser {
  /**
   * @description Send success response with json data
   *
   * @param res
   * @param data
   * @param statusCode
   * @returns
   */
  static successJson = (res: Response, data: unknown, statusCode = 200) =>
    HttpResponser.#sendJson(res, data, statusCode);
  /**
   * @description Send success response with empty data
   *
   * @param res
   * @param statusCode
   * @returns
   */
  static successEmpty = (res: Response, statusCode = 200) =>
    HttpResponser.#sendData(res, null, statusCode);
  /**
   * @description Send error response with json data
   *
   * @param res
   * @param error
   * @param statusCode
   * @returns
   */
  static errorJson = (
    res: Response,
    error: Record<string, string>,
    statusCode = 500
  ) => HttpResponser.#sendJson(res, { error: error.message }, statusCode);

  static #sendJson = (res: Response, data: unknown, statusCode: number) =>
    res.status(statusCode).json(data);
  static #sendData = (res: Response, data: unknown, statusCode: number) =>
    res.status(statusCode).send(data);
}

export default HttpResponser;
