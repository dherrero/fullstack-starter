import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  HttpErrorResponse,
} from '@angular/common/http';
import { AuthInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';
import { signal } from '@angular/core';

describe('AuthInterceptor', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let mockAuthService: {
    token: ReturnType<typeof signal<string>>;
    setToken: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      token: signal(''),
      setToken: vi.fn(),
      logout: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: HTTP_INTERCEPTORS,
          useClass: AuthInterceptor,
          multi: true,
        },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('request handling', () => {
    it('should add Authorization header when token exists', () => {
      mockAuthService.token.set('Bearer test-token');

      httpClient.get('/api/test').subscribe();

      const req = httpMock.expectOne('/api/test');
      expect(req.request.headers.get('Authorization')).toBe(
        'Bearer test-token',
      );
      expect(req.request.withCredentials).toBe(true);

      req.flush({});
    });

    it('should not add Authorization header when token is empty', () => {
      mockAuthService.token.set('');

      httpClient.get('/api/test').subscribe();

      const req = httpMock.expectOne('/api/test');
      expect(req.request.headers.has('Authorization')).toBe(false);
      expect(req.request.withCredentials).toBe(true);

      req.flush({});
    });

    it('should always set withCredentials to true', () => {
      mockAuthService.token.set('');

      httpClient.get('/api/test').subscribe();

      const req = httpMock.expectOne('/api/test');
      expect(req.request.withCredentials).toBe(true);

      req.flush({});
    });

    it('should preserve existing headers', () => {
      mockAuthService.token.set('Bearer test-token');

      httpClient
        .get('/api/test', {
          headers: { 'Content-Type': 'application/json' },
        })
        .subscribe();

      const req = httpMock.expectOne('/api/test');
      expect(req.request.headers.get('Content-Type')).toBe('application/json');
      expect(req.request.headers.get('Authorization')).toBe(
        'Bearer test-token',
      );

      req.flush({});
    });
  });

  describe('response handling', () => {
    it('should capture and set new token from Authorization header', () => {
      mockAuthService.token.set('old-token');

      httpClient.get('/api/test').subscribe();

      const req = httpMock.expectOne('/api/test');
      req.flush(
        {},
        {
          headers: { Authorization: 'Bearer new-token' },
        },
      );

      expect(mockAuthService.setToken).toHaveBeenCalledWith('Bearer new-token');
    });

    it('should not update token if no Authorization header in response', () => {
      mockAuthService.token.set('existing-token');

      httpClient.get('/api/test').subscribe();

      const req = httpMock.expectOne('/api/test');
      req.flush({});

      expect(mockAuthService.setToken).not.toHaveBeenCalled();
    });

    it('should update token on successful response', () => {
      httpClient.get('/api/test').subscribe();

      const req = httpMock.expectOne('/api/test');
      req.flush(
        { data: 'test' },
        {
          headers: { Authorization: 'Bearer response-token' },
        },
      );

      expect(mockAuthService.setToken).toHaveBeenCalledWith(
        'Bearer response-token',
      );
    });
  });

  describe('error handling', () => {
    it('should logout and redirect on 401 error', () => {
      httpClient.get('/api/test').subscribe({
        next: () => fail('should have errored'),
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(401);
          expect(mockAuthService.logout).toHaveBeenCalledWith('/login');
        },
      });

      const req = httpMock.expectOne('/api/test');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });

    it('should not logout on non-401 errors', () => {
      httpClient.get('/api/test').subscribe({
        next: () => fail('should have errored'),
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(404);
          expect(mockAuthService.logout).not.toHaveBeenCalled();
        },
      });

      const req = httpMock.expectOne('/api/test');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });

    it('should propagate error after handling 401', () => {
      let errorReceived = false;

      httpClient.get('/api/test').subscribe({
        next: () => fail('should have errored'),
        error: (error: HttpErrorResponse) => {
          errorReceived = true;
          expect(error.status).toBe(401);
        },
      });

      const req = httpMock.expectOne('/api/test');
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(errorReceived).toBe(true);
    });

    it('should handle 403 error without logout', () => {
      httpClient.get('/api/test').subscribe({
        next: () => fail('should have errored'),
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(403);
          expect(mockAuthService.logout).not.toHaveBeenCalled();
        },
      });

      const req = httpMock.expectOne('/api/test');
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    });

    it('should handle 500 error without logout', () => {
      httpClient.get('/api/test').subscribe({
        next: () => fail('should have errored'),
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(500);
          expect(mockAuthService.logout).not.toHaveBeenCalled();
        },
      });

      const req = httpMock.expectOne('/api/test');
      req.flush('Server Error', { status: 500, statusText: 'Server Error' });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple requests with token refresh', () => {
      mockAuthService.token.set('Bearer initial-token');

      // First request
      httpClient.get('/api/test1').subscribe();
      const req1 = httpMock.expectOne('/api/test1');
      expect(req1.request.headers.get('Authorization')).toBe(
        'Bearer initial-token',
      );
      req1.flush(
        {},
        {
          headers: { Authorization: 'Bearer refreshed-token' },
        },
      );

      // Token should be updated
      mockAuthService.token.set('Bearer refreshed-token');

      // Second request should use new token
      httpClient.get('/api/test2').subscribe();
      const req2 = httpMock.expectOne('/api/test2');
      expect(req2.request.headers.get('Authorization')).toBe(
        'Bearer refreshed-token',
      );
      req2.flush({});
    });

    it('should handle POST request with token', () => {
      mockAuthService.token.set('Bearer test-token');

      httpClient.post('/api/test', { data: 'test' }).subscribe();

      const req = httpMock.expectOne('/api/test');
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe(
        'Bearer test-token',
      );
      expect(req.request.body).toEqual({ data: 'test' });

      req.flush({ success: true });
    });

    it('should handle PUT request with token refresh', () => {
      mockAuthService.token.set('Bearer old-token');

      httpClient.put('/api/test/1', { data: 'updated' }).subscribe();

      const req = httpMock.expectOne('/api/test/1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.headers.get('Authorization')).toBe('Bearer old-token');

      req.flush(
        { success: true },
        {
          headers: { Authorization: 'Bearer new-token' },
        },
      );

      expect(mockAuthService.setToken).toHaveBeenCalledWith('Bearer new-token');
    });

    it('should handle DELETE request with 401 error', () => {
      mockAuthService.token.set('Bearer expired-token');

      httpClient.delete('/api/test/1').subscribe({
        next: () => fail('should have errored'),
        error: (error: HttpErrorResponse) => {
          expect(error.status).toBe(401);
        },
      });

      const req = httpMock.expectOne('/api/test/1');
      expect(req.request.method).toBe('DELETE');
      expect(req.request.headers.get('Authorization')).toBe(
        'Bearer expired-token',
      );

      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(mockAuthService.logout).toHaveBeenCalledWith('/login');
    });
  });
});
