import { describe, it, expect, vi, beforeEach } from 'vitest';
import HttpResponser from './http.responser';
import { Response } from 'express';

describe('HttpResponser', () => {
  let mockResponse: Partial<Response>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let sendMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    sendMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({
      json: jsonMock,
      send: sendMock,
    });

    mockResponse = {
      status: statusMock,
    };
  });

  describe('successJson', () => {
    it('should send JSON response with default status 200', () => {
      // Arrange
      const data = { message: 'Success', id: 1 };

      // Act
      HttpResponser.successJson(mockResponse as Response, data);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(data);
    });

    it('should send JSON response with custom status code', () => {
      // Arrange
      const data = { message: 'Created', id: 123 };
      const statusCode = 201;

      // Act
      HttpResponser.successJson(mockResponse as Response, data, statusCode);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(data);
    });

    it('should handle array data', () => {
      // Arrange
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];

      // Act
      HttpResponser.successJson(mockResponse as Response, data);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(data);
    });

    it('should handle null data', () => {
      // Arrange
      const data = null;

      // Act
      HttpResponser.successJson(mockResponse as Response, data);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(null);
    });

    it('should handle empty object', () => {
      // Arrange
      const data = {};

      // Act
      HttpResponser.successJson(mockResponse as Response, data);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({});
    });
  });

  describe('successEmpty', () => {
    it('should send empty response with default status 200', () => {
      // Act
      HttpResponser.successEmpty(mockResponse as Response);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(sendMock).toHaveBeenCalledWith(null);
    });

    it('should send empty response with custom status code', () => {
      // Arrange
      const statusCode = 204;

      // Act
      HttpResponser.successEmpty(mockResponse as Response, statusCode);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(sendMock).toHaveBeenCalledWith(null);
    });

    it('should use send method instead of json for empty responses', () => {
      // Act
      HttpResponser.successEmpty(mockResponse as Response);

      // Assert
      expect(sendMock).toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });
  });

  describe('errorJson', () => {
    it('should send error response with default status 500', () => {
      // Arrange
      const error = { message: 'Internal server error' };

      // Act
      HttpResponser.errorJson(mockResponse as Response, error);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal server error',
      });
    });

    it('should send error response with custom status code', () => {
      // Arrange
      const error = { message: 'Not found' };
      const statusCode = 404;

      // Act
      HttpResponser.errorJson(mockResponse as Response, error, statusCode);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Not found' });
    });

    it('should format error message correctly', () => {
      // Arrange
      const error = { message: 'Validation failed: email is required' };
      const statusCode = 400;

      // Act
      HttpResponser.errorJson(mockResponse as Response, error, statusCode);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Validation failed: email is required',
      });
    });

    it('should handle error with empty message', () => {
      // Arrange
      const error = { message: '' };

      // Act
      HttpResponser.errorJson(mockResponse as Response, error);

      // Assert
      expect(jsonMock).toHaveBeenCalledWith({ error: '' });
    });

    it('should send 401 for authentication errors', () => {
      // Arrange
      const error = { message: 'Unauthorized' };
      const statusCode = 401;

      // Act
      HttpResponser.errorJson(mockResponse as Response, error, statusCode);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should send 403 for forbidden errors', () => {
      // Arrange
      const error = { message: 'Forbidden' };
      const statusCode = 403;

      // Act
      HttpResponser.errorJson(mockResponse as Response, error, statusCode);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({ error: 'Forbidden' });
    });
  });

  describe('method chaining', () => {
    it('should properly chain status and json methods', () => {
      // Arrange
      const data = { test: 'data' };

      // Act
      HttpResponser.successJson(mockResponse as Response, data, 200);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(statusMock).toHaveReturnedWith({ json: jsonMock, send: sendMock });
      expect(jsonMock).toHaveBeenCalledWith(data);
    });

    it('should properly chain status and send methods', () => {
      // Act
      HttpResponser.successEmpty(mockResponse as Response, 204);

      // Assert
      expect(statusMock).toHaveBeenCalledWith(204);
      expect(statusMock).toHaveReturnedWith({ json: jsonMock, send: sendMock });
      expect(sendMock).toHaveBeenCalledWith(null);
    });
  });
});
