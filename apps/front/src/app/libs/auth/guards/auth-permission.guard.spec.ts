import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Permission } from '@dto';
import { Observable, of } from 'rxjs';
import { UserTokenData } from '../auth.interface';
import { AuthService } from '../services/auth.service';
import {
  canActivateWithAllPermissions,
  canActivateWithAnyPermission,
  canActivateWithPermission,
} from './auth-permission.guard';

@Component({ selector: 'app-admin', template: 'Admin Area', standalone: true })
class AdminComponent {}

@Component({
  selector: 'app-dashboard',
  template: 'Dashboard',
  standalone: true,
})
class DashboardComponent {}

@Component({ selector: 'app-login', template: 'Login', standalone: true })
class LoginComponent {}

@Component({
  selector: 'app-unauthorized',
  template: 'Unauthorized',
  standalone: true,
})
class UnauthorizedComponent {}

const routes: Routes = [
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [canActivateWithPermission(Permission.ADMIN)],
  },
  {
    path: 'dashboard-any',
    component: DashboardComponent,
    canActivate: [
      canActivateWithAnyPermission([
        Permission.ADMIN,
        Permission.WRITE_SOME_ENTITY,
      ]),
    ],
  },
  {
    path: 'dashboard-all',
    component: DashboardComponent,
    canActivate: [
      canActivateWithAllPermissions([
        Permission.ADMIN,
        Permission.WRITE_SOME_ENTITY,
      ]),
    ],
  },
  { path: 'login', component: LoginComponent },
  { path: 'unauthorized', component: UnauthorizedComponent },
];

describe('Auth Permission Guards', () => {
  let mockAuthService: {
    initialize: ReturnType<typeof vi.fn>;
    isLoggedIn$: Observable<boolean>;
    hasAnyPermission: ReturnType<typeof vi.fn>;
    hasAllPermissions: ReturnType<typeof vi.fn>;
    token: ReturnType<typeof signal<string>>;
    tokenDecoded: Partial<UserTokenData>;
  };

  beforeEach(() => {
    mockAuthService = {
      initialize: vi.fn(),
      isLoggedIn$: of(false),
      hasAnyPermission: vi.fn(),
      hasAllPermissions: vi.fn(),
      token: signal(''),
      tokenDecoded: { permissions: [] },
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
  });

  describe('canActivateWithPermission', () => {
    it('should allow activation when user has required permission', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.tokenDecoded = {
        permissions: [Permission.ADMIN],
      };

      const harness = await RouterTestingHarness.create('/admin');

      expect(harness.routeNativeElement?.textContent).toContain('Admin Area');
      expect(mockAuthService.initialize).toHaveBeenCalled();
    });

    it('should redirect to unauthorized when user lacks permission', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.tokenDecoded = {
        permissions: [Permission.READ_SOME_ENTITY],
      };

      const harness = await RouterTestingHarness.create('/admin');

      expect(harness.routeNativeElement?.textContent).toContain('Unauthorized');
    });

    it('should redirect to login when user is not logged in', async () => {
      mockAuthService.initialize.mockReturnValue(of(false));
      mockAuthService.isLoggedIn$ = of(false);

      const harness = await RouterTestingHarness.create('/admin');

      expect(harness.routeNativeElement?.textContent).toContain('Login');
    });

    it('should handle missing permissions array', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.tokenDecoded = {};

      const harness = await RouterTestingHarness.create('/admin');

      expect(harness.routeNativeElement?.textContent).toContain('Unauthorized');
    });
  });

  describe('canActivateWithAnyPermission', () => {
    it('should allow activation when user has any required permission', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAnyPermission.mockReturnValue(true);

      const harness = await RouterTestingHarness.create('/dashboard-any');

      expect(harness.routeNativeElement?.textContent).toContain('Dashboard');
      expect(mockAuthService.hasAnyPermission).toHaveBeenCalledWith([
        Permission.ADMIN,
        Permission.WRITE_SOME_ENTITY,
      ]);
    });

    it('should redirect to unauthorized when user lacks all permissions', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAnyPermission.mockReturnValue(false);

      const harness = await RouterTestingHarness.create('/dashboard-any');

      expect(harness.routeNativeElement?.textContent).toContain('Unauthorized');
    });

    it('should redirect to login when user is not logged in', async () => {
      mockAuthService.initialize.mockReturnValue(of(false));
      mockAuthService.isLoggedIn$ = of(false);

      const harness = await RouterTestingHarness.create('/dashboard-any');

      expect(harness.routeNativeElement?.textContent).toContain('Login');
    });

    it('should work with single permission', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAnyPermission.mockReturnValue(true);

      const harness = await RouterTestingHarness.create('/dashboard-any');

      expect(harness.routeNativeElement?.textContent).toContain('Dashboard');
      expect(mockAuthService.hasAnyPermission).toHaveBeenCalled();
    });
  });

  describe('canActivateWithAllPermissions', () => {
    it('should allow activation when user has all required permissions', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAllPermissions.mockReturnValue(true);

      const harness = await RouterTestingHarness.create('/dashboard-all');

      expect(harness.routeNativeElement?.textContent).toContain('Dashboard');
      expect(mockAuthService.hasAllPermissions).toHaveBeenCalledWith([
        Permission.ADMIN,
        Permission.WRITE_SOME_ENTITY,
      ]);
    });

    it('should redirect to unauthorized when user lacks any permission', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAllPermissions.mockReturnValue(false);

      const harness = await RouterTestingHarness.create('/dashboard-all');

      expect(harness.routeNativeElement?.textContent).toContain('Unauthorized');
    });

    it('should redirect to login when user is not logged in', async () => {
      mockAuthService.initialize.mockReturnValue(of(false));
      mockAuthService.isLoggedIn$ = of(false);

      const harness = await RouterTestingHarness.create('/dashboard-all');

      expect(harness.routeNativeElement?.textContent).toContain('Login');
    });

    it('should work with multiple permissions', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAllPermissions.mockReturnValue(true);

      const harness = await RouterTestingHarness.create('/dashboard-all');

      expect(harness.routeNativeElement?.textContent).toContain('Dashboard');
      expect(mockAuthService.hasAllPermissions).toHaveBeenCalled();
    });

    it('should differentiate between hasAny and hasAll behavior', async () => {
      mockAuthService.initialize.mockReturnValue(of(true));
      mockAuthService.isLoggedIn$ = of(true);
      mockAuthService.hasAllPermissions.mockReturnValue(false);
      mockAuthService.hasAnyPermission.mockReturnValue(true);

      const harness = await RouterTestingHarness.create('/dashboard-all');

      expect(harness.routeNativeElement?.textContent).toContain('Unauthorized');
      expect(mockAuthService.hasAllPermissions).toHaveBeenCalled();
      expect(mockAuthService.hasAnyPermission).not.toHaveBeenCalled();
    });
  });
});
