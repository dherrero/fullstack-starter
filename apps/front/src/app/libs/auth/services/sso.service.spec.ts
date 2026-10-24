import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SsoProviderPublicDTO } from '@dto';
import { SsoService, SSO_CALLBACK_PATH } from './sso.service';
import { AUTH_CONFIGURATION } from '../auth.constants';

describe('SsoService', () => {
  let service: SsoService;
  let httpMock: HttpTestingController;
  const cfg = {
    idpServer: 'http://localhost:3200/auth',
    pingUrl: 'http://localhost:3200/health/secure',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SsoService, { provide: AUTH_CONFIGURATION, useValue: cfg }],
    });
    service = TestBed.inject(SsoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches the public provider list with credentials', async () => {
    const promise = firstValueFrom(service.getProviders());
    const req = httpMock.expectOne('http://localhost:3200/auth/sso/providers');
    expect(req.request.method).toBe('GET');
    expect(req.request.withCredentials).toBe(true);
    req.flush([{ id: 'okta', displayName: 'Okta' }]);
    expect(await promise).toEqual([{ id: 'okta', displayName: 'Okta' }]);
  });

  it('returns mixed OIDC and SAML providers preserving the protocol field', async () => {
    const mixed: SsoProviderPublicDTO[] = [
      { id: 'okta', displayName: 'Okta', protocol: 'oidc' },
      { id: 'adfs', displayName: 'ADFS', protocol: 'saml' },
      { id: 'legacy', displayName: 'Legacy' }, // no protocol — defaults to oidc on the backend
      {
        id: 'saml-corp',
        displayName: 'Corp SSO',
        protocol: 'saml',
        iconKey: 'corp-logo',
      },
    ];
    const promise = firstValueFrom(service.getProviders());
    const req = httpMock.expectOne('http://localhost:3200/auth/sso/providers');
    req.flush(mixed);
    const result = await promise;
    // Typed as SsoProviderPublicDTO[] — no runtime coercion needed
    expect(result).toHaveLength(4);
    expect(result[0].protocol).toBe('oidc');
    expect(result[1].protocol).toBe('saml');
    expect(result[2].protocol).toBeUndefined(); // optional — absent means oidc by convention
    expect(result[3].protocol).toBe('saml');
    expect(result[3].iconKey).toBe('corp-logo');
  });

  it('builds a login url with an encoded same-site returnTo', () => {
    expect(service.buildLoginUrl('okta')).toBe(
      `http://localhost:3200/auth/sso/okta/login?returnTo=${encodeURIComponent(
        SSO_CALLBACK_PATH,
      )}`,
    );
  });

  it('encodes the provider id (no path injection)', () => {
    expect(service.buildLoginUrl('a/b')).toContain('/sso/a%2Fb/login');
  });

  it('login navigates the browser to the gateway login url', () => {
    const spy = vi
      .spyOn(window.location, 'assign')
      .mockImplementation(() => undefined);
    service.login('okta');
    expect(spy).toHaveBeenCalledWith(service.buildLoginUrl('okta'));
    spy.mockRestore();
  });
});
