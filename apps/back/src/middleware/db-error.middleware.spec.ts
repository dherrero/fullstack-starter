/* eslint-disable @typescript-eslint/no-empty-function */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  dbErrorMiddleware,
  sequelizeErrorMiddleware,
  dbLoggingMiddleware,
} from './db-error.middleware';
import { Request, Response, NextFunction } from 'express';
import * as pgConnector from '../adapters/db/pg.connector';

// Mock pg.connector
vi.mock('../adapters/db/pg.connector', () => ({
  isConnected: vi.fn(),
}));

describe('Database Error Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    sendMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({
      json: jsonMock,
      send: sendMock,
    });

    mockRequest = {
      method: 'GET',
      path: '/api/test',
      ip: '127.0.0.1',
      get: vi.fn().mockReturnValue('Test User Agent'),
    };

    mockResponse = {
      status: statusMock,
      statusCode: 200,
      send: sendMock,
    };

    mockNext = vi.fn();

    // Mock Date.toISOString to have consistent timestamps in tests
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(
      '2025-10-27T12:00:00.000Z'
    );
  });

  describe('dbErrorMiddleware', () => {
    it('should call next when database is connected', () => {
      // Arrange
      vi.mocked(pgConnector.isConnected).mockReturnValue(true);

      // Act
      dbErrorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(pgConnector.isConnected).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should return 503 error when database is not connected', () => {
      // Arrange
      vi.mocked(pgConnector.isConnected).mockReturnValue(false);

      // Act
      dbErrorMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(pgConnector.isConnected).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Database is currently unavailable. Please try again later.',
        code: 'DB_UNAVAILABLE',
        timestamp: '2025-10-27T12:00:00.000Z',
        retryAfter: 30,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('sequelizeErrorMiddleware', () => {
    it('should handle SequelizeConnectionError', () => {
      // Arrange
      const error = { name: 'SequelizeConnectionError', message: 'Failed' };
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith('Database error:', error);
      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Database connection error. Please try again later.',
        code: 'DB_CONNECTION_ERROR',
        timestamp: '2025-10-27T12:00:00.000Z',
        retryAfter: 30,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle SequelizeTimeoutError', () => {
      // Arrange
      const error = { name: 'SequelizeTimeoutError', message: 'Timeout' };
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(504);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Gateway Timeout',
        message: 'Database operation timed out. Please try again.',
        code: 'DB_TIMEOUT',
        timestamp: '2025-10-27T12:00:00.000Z',
        retryAfter: 10,
      });
    });

    it('should handle SequelizeValidationError with error details', () => {
      // Arrange
      const error = {
        name: 'SequelizeValidationError',
        message: 'Validation failed',
        errors: [
          { path: 'email', message: 'Email is required', value: null },
          { path: 'password', message: 'Password too short', value: '123' },
        ],
      };
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Validation Error',
        message: 'Invalid data provided',
        code: 'DB_VALIDATION_ERROR',
        details: [
          { field: 'email', message: 'Email is required', value: null },
          { field: 'password', message: 'Password too short', value: '123' },
        ],
        timestamp: '2025-10-27T12:00:00.000Z',
      });
    });

    it('should handle SequelizeUniqueConstraintError', () => {
      // Arrange
      const error = {
        name: 'SequelizeUniqueConstraintError',
        message: 'Unique constraint violated',
        errors: [{ path: 'email' }],
      };
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(409);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Conflict',
        message: 'Resource already exists',
        code: 'DB_UNIQUE_CONSTRAINT',
        field: 'email',
        timestamp: '2025-10-27T12:00:00.000Z',
      });
    });

    it('should handle SequelizeForeignKeyConstraintError', () => {
      // Arrange
      const error = {
        name: 'SequelizeForeignKeyConstraintError',
        message: 'Foreign key constraint violated',
      };
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Referenced resource does not exist',
        code: 'DB_FOREIGN_KEY_ERROR',
        timestamp: '2025-10-27T12:00:00.000Z',
      });
    });

    it('should handle unknown Sequelize errors with generic response', () => {
      // Arrange
      const error = {
        name: 'SequelizeUnknownError',
        message: 'Some unknown error',
      };
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Database error occurred',
        code: 'DB_ERROR',
        timestamp: '2025-10-27T12:00:00.000Z',
      });
    });

    it('should call next for non-Sequelize errors', () => {
      // Arrange
      const error = { name: 'RegularError', message: 'Not a Sequelize error' };

      // Act
      sequelizeErrorMiddleware(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should handle all connection-related errors', () => {
      const connectionErrors = [
        'SequelizeConnectionRefusedError',
        'SequelizeHostNotFoundError',
        'SequelizeHostNotReachableError',
        'SequelizeConnectionTimedOutError',
      ];

      vi.spyOn(console, 'error').mockImplementation(() => {});

      connectionErrors.forEach((errorName) => {
        vi.clearAllMocks();

        const error = { name: errorName, message: 'Connection failed' };

        sequelizeErrorMiddleware(
          error,
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        expect(statusMock).toHaveBeenCalledWith(503);
        expect(jsonMock).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'DB_CONNECTION_ERROR',
          })
        );
      });
    });
  });

  describe('dbLoggingMiddleware', () => {
    it('should call next without logging for successful responses', () => {
      // Arrange
      mockResponse.statusCode = 200;
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      dbLoggingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log server errors (5xx) when response is sent', () => {
      // Arrange
      mockResponse.statusCode = 503;
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const testData = { error: 'Database unavailable' };

      // Act
      dbLoggingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Simulate sending response
      mockResponse.send(testData);

      // Assert
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Database error on GET /api/test:',
        {
          statusCode: 503,
          body: testData,
          timestamp: '2025-10-27T12:00:00.000Z',
          userAgent: 'Test User Agent',
          ip: '127.0.0.1',
        }
      );
    });

    it('should not log client errors (4xx)', () => {
      // Arrange
      mockResponse.statusCode = 400;
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Act
      dbLoggingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.send({ error: 'Bad request' });

      // Assert
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should call original send method', () => {
      // Arrange
      const testData = { error: 'Server error' };
      mockResponse.statusCode = 500;
      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Act
      dbLoggingMiddleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      mockResponse.send(testData);

      // Assert
      expect(sendMock).toHaveBeenCalledWith(testData);
    });

    it('should log different 5xx status codes', () => {
      const serverErrors = [500, 501, 502, 503, 504, 505];
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      serverErrors.forEach((statusCode) => {
        vi.clearAllMocks();
        mockResponse.statusCode = statusCode;
        mockResponse.send = sendMock;

        dbLoggingMiddleware(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );

        mockResponse.send({ error: 'Error' });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Database error'),
          expect.objectContaining({ statusCode })
        );
      });
    });
  });
});
