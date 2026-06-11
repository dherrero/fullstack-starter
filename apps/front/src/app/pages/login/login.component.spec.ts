import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { SsoProviderPublicDTO } from '@dto';
import LoginComponent from './login.component';
import { AuthService } from '@front/app/libs/auth/services/auth.service';
import { SsoService } from '@front/app/libs/auth/services/sso.service';

describe('LoginComponent (SSO integration)', () => {
  const getProviders = vi.fn();
  const ssoLogin = vi.fn();

  const setup = (
    hasSsoError = false,
  ): { cmp: LoginComponent; fixture: ComponentFixture<LoginComponent> } => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        // Real (test) transloco wiring so the template's transloco pipe
        // renders; missing keys fall back to the key itself.
        TranslocoTestingModule.forRoot({
          langs: {
            en: {
              login: {
                sso: { continueWith: 'Continue with {{provider}}' },
              },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
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
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    return { cmp: fixture.componentInstance, fixture };
  };

  beforeEach(() => vi.clearAllMocks());

  it('renders a button per configured provider', () => {
    getProviders.mockReturnValue(of([{ id: 'okta', displayName: 'Okta' }]));
    const { cmp } = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toEqual([{ id: 'okta', displayName: 'Okta' }]);
  });

  it('shows no providers when none are configured', () => {
    getProviders.mockReturnValue(of([]));
    const { cmp } = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toEqual([]);
  });

  it('falls back to empty providers if the request fails', () => {
    getProviders.mockReturnValue(throwError(() => new Error('boom')));
    const { cmp } = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toEqual([]);
  });

  it('surfaces a generic error when the gateway flags sso_error', () => {
    getProviders.mockReturnValue(of([]));
    const { cmp } = setup(true);
    cmp.ngOnInit();
    expect(cmp.error).toEqual(['login.sso.error']);
  });

  it('starts the federated flow via the SSO service', () => {
    getProviders.mockReturnValue(of([]));
    const { cmp } = setup();
    cmp.loginWithSso('okta');
    expect(ssoLogin).toHaveBeenCalledWith('okta');
  });

  it('renders one button per provider in a mixed OIDC+SAML list', () => {
    const mixed: SsoProviderPublicDTO[] = [
      { id: 'okta', displayName: 'Okta', protocol: 'oidc' },
      { id: 'adfs', displayName: 'ADFS', protocol: 'saml' },
      { id: 'legacy', displayName: 'Legacy Corp' },
    ];
    getProviders.mockReturnValue(of(mixed));
    const { cmp } = setup();
    cmp.ngOnInit();
    expect(cmp.providers()).toHaveLength(3);
    expect(cmp.providers()[1].protocol).toBe('saml');
  });

  it('shows the SAML badge for a provider with protocol=saml and no iconKey', () => {
    const samlProvider: SsoProviderPublicDTO = {
      id: 'adfs',
      displayName: 'ADFS',
      protocol: 'saml',
    };
    getProviders.mockReturnValue(of([samlProvider]));
    const { cmp, fixture } = setup();
    cmp.ngOnInit();
    fixture.detectChanges();
    const badge: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="saml-badge"]',
    );
    expect(badge).not.toBeNull();
  });

  it('does not show the SAML badge when a SAML provider has an iconKey', () => {
    const samlWithIcon: SsoProviderPublicDTO = {
      id: 'adfs',
      displayName: 'ADFS',
      protocol: 'saml',
      iconKey: 'adfs-logo',
    };
    getProviders.mockReturnValue(of([samlWithIcon]));
    const { cmp, fixture } = setup();
    cmp.ngOnInit();
    fixture.detectChanges();
    const badge: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="saml-badge"]',
    );
    expect(badge).toBeNull();
  });

  it('does not show the SAML badge for an OIDC provider', () => {
    const oidcProvider: SsoProviderPublicDTO = {
      id: 'okta',
      displayName: 'Okta',
      protocol: 'oidc',
    };
    getProviders.mockReturnValue(of([oidcProvider]));
    const { cmp, fixture } = setup();
    cmp.ngOnInit();
    fixture.detectChanges();
    const badge: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="saml-badge"]',
    );
    expect(badge).toBeNull();
  });

  it('renders displayName as text — a malicious displayName does not inject elements', () => {
    const xssProvider: SsoProviderPublicDTO = {
      id: 'evil',
      displayName: '<script>alert(1)</script>Evil Corp',
      protocol: 'saml',
    };
    getProviders.mockReturnValue(of([xssProvider]));
    const { cmp, fixture } = setup();
    cmp.ngOnInit();
    fixture.detectChanges();
    // No <script> element must exist inside the rendered component
    const scripts = fixture.nativeElement.querySelectorAll('script');
    expect(scripts.length).toBe(0);
    // The literal text (encoded by Angular interpolation) is present as text content
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="sso-btn-evil"]',
    );
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Evil Corp');
  });
});
