import { NextFunction, Request, Response } from 'express';
import { isConnected } from '../adapters/db/pg.connector';

/**
 * Middleware para manejar errores de base de datos
 * Proporciona respuestas apropiadas cuando la DB no está disponible
 */
export const dbErrorMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Verificar si la base de datos está conectada
  if (!isConnected()) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database is currently unavailable. Please try again later.',
      code: 'DB_UNAVAILABLE',
      timestamp: new Date().toISOString(),
      retryAfter: 30, // Sugerir reintentar en 30 segundos
    });
  }

  next();
};

/**
 * Middleware para manejar errores de Sequelize
 * Intercepta errores de base de datos y los formatea apropiadamente
 */
export const sequelizeErrorMiddleware = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Verificar si es un error de Sequelize
  if (error.name && error.name.startsWith('Sequelize')) {
    // Log only error metadata — never the full error object, which can carry
    // query fragments and parameter values (PII / sensitive data).
    console.error('Database error:', {
      name: error.name,
      code: error.original?.code ?? error.parent?.code,
    });

    // Mapear errores comunes de Sequelize
    switch (error.name) {
      case 'SequelizeConnectionError':
      case 'SequelizeConnectionRefusedError':
      case 'SequelizeHostNotFoundError':
      case 'SequelizeHostNotReachableError':
      case 'SequelizeConnectionTimedOutError':
        return res.status(503).json({
          error: 'Service Unavailable',
          message: 'Database connection error. Please try again later.',
          code: 'DB_CONNECTION_ERROR',
          timestamp: new Date().toISOString(),
          retryAfter: 30,
        });

      case 'SequelizeTimeoutError':
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Database operation timed out. Please try again.',
          code: 'DB_TIMEOUT',
          timestamp: new Date().toISOString(),
          retryAfter: 10,
        });

      case 'SequelizeValidationError':
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid data provided',
          code: 'DB_VALIDATION_ERROR',
          details: error.errors?.map((err: any) => ({
            field: err.path,
            message: err.message,
            value: err.value,
          })),
          timestamp: new Date().toISOString(),
        });

      case 'SequelizeUniqueConstraintError':
        return res.status(409).json({
          error: 'Conflict',
          message: 'Resource already exists',
          code: 'DB_UNIQUE_CONSTRAINT',
          field: error.errors?.[0]?.path,
          timestamp: new Date().toISOString(),
        });

      case 'SequelizeForeignKeyConstraintError':
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Referenced resource does not exist',
          code: 'DB_FOREIGN_KEY_ERROR',
          timestamp: new Date().toISOString(),
        });

      default:
        return res.status(500).json({
          error: 'Internal Server Error',
          message: 'Database error occurred',
          code: 'DB_ERROR',
          timestamp: new Date().toISOString(),
        });
    }
  }

  // Si no es un error de Sequelize, pasar al siguiente middleware
  next(error);
};

/**
 * Middleware para logging de errores de base de datos
 */
export const dbLoggingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const originalSend = res.send;

  res.send = function (data) {
    // Log only request/response metadata on 5xx — never the response body,
    // client IP or User-Agent (PII and potential leakage of error internals).
    if (res.statusCode >= 500 && res.statusCode < 600) {
      console.error(`Server error on ${req.method} ${req.path}:`, {
        statusCode: res.statusCode,
        timestamp: new Date().toISOString(),
      });
    }

    return originalSend.call(this, data);
  };

  next();
};
