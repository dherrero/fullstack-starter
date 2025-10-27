import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { canActivateFn } from './auth.guard';

@Component({
  selector: 'app-protected',
  template: 'Protected',
  standalone: true,
})
class ProtectedComponent {}

@Component({ selector: 'app-login', template: 'Login', standalone: true })
class LoginComponent {}

const routes: Routes = [
  {
    path: 'protected',
    component: ProtectedComponent,
    canActivate: [canActivateFn],
  },
  { path: 'login', component: LoginComponent },
];

describe('Auth Guard - canActivateFn', () => {
  let mockAuthService: {
    initialize: ReturnType<typeof vi.fn>;
    isLoggedIn$: Observable<boolean>;
    token: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAuthService = {
      initialize: vi.fn(),
      isLoggedIn$: of(false),
      token: vi.fn().mockReturnValue(''),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
  });

  it('should allow activation when user is logged in', async () => {
    mockAuthService.initialize.mockReturnValue(of(true));
    mockAuthService.isLoggedIn$ = of(true);

    const harness = await RouterTestingHarness.create('/protected');

    expect(harness.routeNativeElement?.textContent).toContain('Protected');
    expect(mockAuthService.initialize).toHaveBeenCalled();
  });

  it('should redirect to login when user is not logged in', async () => {
    mockAuthService.initialize.mockReturnValue(of(false));
    mockAuthService.isLoggedIn$ = of(false);

    const harness = await RouterTestingHarness.create('/protected');

    expect(harness.routeNativeElement?.textContent).toContain('Login');
    expect(mockAuthService.initialize).toHaveBeenCalled();
  });

  it('should allow activation after successful initialization', async () => {
    mockAuthService.initialize.mockReturnValue(of(true));
    mockAuthService.isLoggedIn$ = of(true);

    const harness = await RouterTestingHarness.create('/protected');

    expect(harness.routeNativeElement?.textContent).toContain('Protected');
  });

  it('should redirect to login if initialization succeeds but user not logged in', async () => {
    mockAuthService.initialize.mockReturnValue(of(true));
    mockAuthService.isLoggedIn$ = of(false);

    const harness = await RouterTestingHarness.create('/protected');

    expect(harness.routeNativeElement?.textContent).toContain('Login');
  });
});
