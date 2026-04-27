import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { Permission } from '@dto';
import { AuthService } from './auth.service';
import { AUTH_CONFIGURATION } from '../auth.constants';
import { firstValueFrom } from 'rxjs';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let mockRouter: { navigateByUrl: ReturnType<typeof vi.fn> };
  const mockAuthConfig = {
    idpServer: 'http://localhost:3200',
    pingUrl: 'http://localhost:3200/health/secure',
  };

  beforeEach(() => {
    mockRouter = {
      navigateByUrl: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: mockRouter },
        { provide: AUTH_CONFIGURATION, useValue: mockAuthConfig },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('token management', () => {
    it('should initialize with empty token', () => {
      expect(service.token()).toBe('');
    });

    it('should set token', () => {
      const token = 'test-token';
      service.setToken(token);
      expect(service.token()).toBe(token);
    });

    it('should decode token correctly', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;

      service.setToken(token);

      expect(service.tokenDecoded).toEqual(userData);
    });
  });

  describe('isLoggedIn$ observable', () => {
    it('should emit false when token is empty', (done) => {
      service.token.set('');

      service.isLoggedIn$.subscribe((isLoggedIn) => {
        expect(isLoggedIn).toBe(false);
        done();
      });
    });

    it('should emit true when token is set', (done) => {
      service.token.set('valid-token');

      service.isLoggedIn$.subscribe((isLoggedIn) => {
        expect(isLoggedIn).toBe(true);
        done();
      });
    });
  });

  describe('login', () => {
    it('should login successfully and set token', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        remember: true,
      };
      const expectedToken = 'Bearer valid-token';

      const loginPromise = firstValueFrom(service.login(loginData));

      const req = httpMock.expectOne('http://localhost:3200/login');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(loginData);
      expect(req.request.withCredentials).toBe(true);

      req.flush(null, {
        headers: { Authorization: expectedToken },
      });

      await loginPromise;
      expect(service.token()).toBe(expectedToken);
    });

    it('should handle login without Authorization header', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
        remember: false,
      };

      const loginPromise = firstValueFrom(service.login(loginData));

      const req = httpMock.expectOne('http://localhost:3200/login');
      req.flush(null);

      await loginPromise;
      expect(service.token()).toBe('');
    });
  });

  describe('logout', () => {
    it('should logout and clear tokens', () => {
      service.setToken('valid-token');

      service.logout();

      const req = httpMock.expectOne('http://localhost:3200/logout');
      expect(req.request.method).toBe('POST');
      expect(req.request.withCredentials).toBe(true);

      req.flush(null);

      expect(service.token()).toBe('');
    });

    it('should logout and redirect', () => {
      service.setToken('valid-token');

      service.logout('/login');

      const req = httpMock.expectOne('http://localhost:3200/logout');
      req.flush(null);

      expect(service.token()).toBe('');
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('should clear tokens even if logout request fails', () => {
      service.setToken('valid-token');

      service.logout('/login');

      const req = httpMock.expectOne('http://localhost:3200/logout');
      req.error(new ProgressEvent('error'));

      expect(service.token()).toBe('');
      expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/login');
    });
  });

  describe('initialize', () => {
    it('should initialize and set token from ping response', async () => {
      const expectedToken = 'Bearer refreshed-token';

      const initPromise = firstValueFrom(service.initialize());

      const req = httpMock.expectOne('http://localhost:3200/health/secure');
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);

      req.flush(null, {
        headers: { Authorization: expectedToken },
      });

      const result = await initPromise;
      expect(result).toBe(true);
      expect(service.token()).toBe(expectedToken);
    });

    it('should return false if no Authorization header in response', async () => {
      const initPromise = firstValueFrom(service.initialize());

      const req = httpMock.expectOne('http://localhost:3200/health/secure');
      req.flush(null);

      const result = await initPromise;
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const initPromise = firstValueFrom(service.initialize());

      const req = httpMock.expectOne('http://localhost:3200/health/secure');
      req.error(new ProgressEvent('error'));

      const result = await initPromise;
      expect(result).toBe(false);
    });

    it('should return true if already initialized', async () => {
      // First initialization
      const initPromise1 = firstValueFrom(service.initialize());
      const req1 = httpMock.expectOne('http://localhost:3200/health/secure');
      req1.flush(null, { headers: { Authorization: 'Bearer token' } });
      await initPromise1;

      // Second call should not make HTTP request
      const result = await firstValueFrom(service.initialize());
      expect(result).toBe(true);
      httpMock.expectNone('http://localhost:3200/health/secure');
    });

    it('should return false if no pingUrl configured', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthService,
          { provide: Router, useValue: mockRouter },
          {
            provide: AUTH_CONFIGURATION,
            useValue: { idpServer: 'http://localhost:3200' },
          },
        ],
      });

      const serviceNoPing = TestBed.inject(AuthService);
      const result = await firstValueFrom(serviceNoPing.initialize());

      expect(result).toBe(false);
    });
  });

  describe('doPing', () => {
    it('should ping and update token', async () => {
      const expectedToken = 'Bearer new-token';

      const pingPromise = firstValueFrom(service.doPing());

      const req = httpMock.expectOne('http://localhost:3200/health/secure');
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);

      req.flush(null, {
        headers: { Authorization: expectedToken },
      });

      await pingPromise;
      expect(service.token()).toBe(expectedToken);
    });

    it('should not update token if no Authorization header', async () => {
      service.setToken('old-token');

      const pingPromise = firstValueFrom(service.doPing());

      const req = httpMock.expectOne('http://localhost:3200/health/secure');
      req.flush(null);

      await pingPromise;
      expect(service.token()).toBe('old-token');
    });

    it('should return of(null) if no pingUrl configured', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          AuthService,
          { provide: Router, useValue: mockRouter },
          {
            provide: AUTH_CONFIGURATION,
            useValue: { idpServer: 'http://localhost:3200' },
          },
        ],
      });

      const serviceNoPing = TestBed.inject(AuthService);
      const result = await firstValueFrom(serviceNoPing.doPing());

      expect(result).toBeNull();
    });
  });

  describe('permission checks', () => {
    it('should return true if user has the permission', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(service.hasPermission(Permission.ADMIN)).toBe(true);
      expect(service.hasPermission(Permission.READ_SOME_ENTITY)).toBe(true);
    });

    it('should return false if user does not have the permission', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(service.hasPermission(Permission.WRITE_SOME_ENTITY)).toBe(false);
    });

    it('should return true if user has at least one permission', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(
        service.hasAnyPermission([
          Permission.ADMIN,
          Permission.WRITE_SOME_ENTITY,
        ]),
      ).toBe(true);
    });

    it('should return false if user has none of the permissions in hasAnyPermission', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(service.hasAnyPermission([Permission.WRITE_SOME_ENTITY])).toBe(
        false,
      );
    });

    it('should return true if user has all permissions', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(
        service.hasAllPermissions([
          Permission.ADMIN,
          Permission.READ_SOME_ENTITY,
        ]),
      ).toBe(true);
    });

    it('should return false if user is missing any permission in hasAllPermissions', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(
        service.hasAllPermissions([
          Permission.ADMIN,
          Permission.WRITE_SOME_ENTITY,
        ]),
      ).toBe(false);
    });

    it('should return true if user has ADMIN permission with isAdmin method', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.ADMIN, Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(service.isAdmin()).toBe(true);
    });

    it('should return false if user does not have ADMIN permission with isAdmin method', () => {
      const userData = {
        id: 1,
        email: 'test@example.com',
        permissions: [Permission.READ_SOME_ENTITY],
        remember: true,
      };
      const payload = btoa(JSON.stringify(userData));
      const token = `header.${payload}.signature`;
      service.setToken(token);

      expect(service.isAdmin()).toBe(false);
    });
  });
});
