import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import LoginComponent from './login.component';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
import { SsoService } from '@front/app/libs/auth/services/sso.service';

describe('LoginComponent (SSO integration)', () => {
  const getProviders = vi.fn();
  const ssoLogin = vi.fn();

  const setup = (hasSsoError = false) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: SsoService, useValue: { getProviders, login: ssoLogin } },
        { provide: AuthService, useValue: { login: vi.fn() } },
        {
          provide: Router,
          useValue: { currentNavigation: () => null, navigateByUrl: vi.fn() },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                has: (k: string) => hasSsoError && k === 'sso_error',
              },
            },
          },
        },
        {
          provide: TranslocoService,
          useValue: { translate: (k: string) => k },
        },
      ],
    });
    return TestBed.createComponent(LoginComponent).componentInstance;
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders a button per configured provider', () => {
    getProviders.mockReturnValue(of([{ id: 'okta', displayName: 'Okta' }]));
    const cmp = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toEqual([{ id: 'okta', displayName: 'Okta' }]);
  });

  it('shows no providers when none are configured', () => {
    getProviders.mockReturnValue(of([]));
    const cmp = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toEqual([]);
  });

  it('falls back to empty providers if the request fails', () => {
    getProviders.mockReturnValue(throwError(() => new Error('boom')));
    const cmp = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toEqual([]);
  });

  it('surfaces a generic error when the gateway flags sso_error', () => {
    getProviders.mockReturnValue(of([]));
    const cmp = setup(true);
    cmp.ngOnInit();
    expect(cmp.error).toEqual(['login.sso.error']);
  });

  it('starts the federated flow via the SSO service', () => {
    getProviders.mockReturnValue(of([]));
    const cmp = setup();
    cmp.loginWithSso('okta');
    expect(ssoLogin).toHaveBeenCalledWith('okta');
  });
});
