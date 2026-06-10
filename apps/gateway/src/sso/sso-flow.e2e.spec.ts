import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { OAuth2Server } from 'oauth2-mock-server';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Permission } from '@dto';

// The api boundary is mocked so this e2e needs no Postgres/api: it exercises the
// REAL OIDC handshake (discovery, PKCE, state, nonce, ID-token JWKS validation)
// of the gateway against a REAL mock IdP, plus the state-tamper attack case.
vi.mock('@gateway/clients/api.client', () => ({
  ApiClient: {
    resolveFederatedUser: vi.fn().mockResolvedValue({
      id: 42,
      email: 'alice@corp.com',
      permissions: [Permission.WRITE_SOME_ENTITY],
    }),
    recordRefresh: vi.fn().mockResolvedValue({ recorded: true }),
  },
}));

import { ApiClient } from '@gateway/clients/api.client';
import authRouter from '@gateway/routes/auth.routes';
import { resetDiscoveryCache } from '@gateway/sso/discovery';
import { resetRegistryCache } from '@gateway/sso/provider-registry';

const REDIRECT_URI = 'http://localhost:3100/api/v1/auth/sso/test/callback';

let idp: OAuth2Server;
let app: Express;

const buildApp = (): Express => {
  const a = express();
  a.use(cookieParser());
  a.use(express.json());
  a.use('/api/v1/auth', authRouter);
  return a;
};

// Cookie header from a Set-Cookie array (name=value pairs only).
const cookieHeader = (setCookie: string[] | undefined): string =>
  (setCookie ?? []).map((c) => c.split(';')[0]).join('; ');

/** Start the flow at the gateway; return the IdP authorize URL + tx cookie. */
const startLogin = async () => {
  const res = await request(app).get(
    '/api/v1/auth/sso/test/login?returnTo=/dashboard',
  );
  expect(res.status).toBe(302);
  const authUrl = new URL(res.headers.location);
  return { authUrl, txCookie: cookieHeader(res.headers['set-cookie']) };
};

describe('SSO OIDC flow (e2e against a real mock IdP)', () => {
  beforeAll(async () => {
    idp = new OAuth2Server();
    await idp.issuer.keys.generate('RS256');
    await idp.start(0, 'localhost');

    // Claims the IdP asserts for the authenticated user.
    idp.service.on('beforeTokenSigning', (token) => {
      token.payload.email = 'alice@corp.com';
      token.payload.email_verified = true;
      token.payload.groups = ['admins'];
    });

    process.env.SSO_ALLOW_INSECURE_ISSUERS = 'true'; // localhost IdP, dev only
    process.env.SSO_TEST_ISSUER = idp.issuer.url as string;
    process.env.SSO_TEST_CLIENT_ID = 'gateway-client';
    process.env.SSO_TEST_CLIENT_SECRET = 'gateway-secret';
    process.env.SSO_TEST_REDIRECT_URI = REDIRECT_URI;
    process.env.SSO_TEST_PERMISSION_MAP = 'admins:WRITE_SOME_ENTITY';
    process.env.SSO_STATE_SECRET = 'e2e-state-secret';
    process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';

    resetRegistryCache();
    resetDiscoveryCache();
    app = buildApp();
  });

  afterAll(async () => {
    await idp.stop();
  });

  beforeEach(() => vi.clearAllMocks());

  it('happy path: login → IdP → callback issues the local session', async () => {
    const { authUrl, txCookie } = await startLogin();

    // The gateway must redirect to the IdP with PKCE S256 + state + nonce.
    expect(authUrl.origin).toBe(new URL(idp.issuer.url as string).origin);
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authUrl.searchParams.get('code_challenge')).toBeTruthy();
    expect(authUrl.searchParams.get('state')).toBeTruthy();
    expect(authUrl.searchParams.get('nonce')).toBeTruthy();

    // Simulate the user authenticating at the IdP (auto-approve → code).
    const idpRes = await fetch(authUrl.href, { redirect: 'manual' });
    const cb = new URL(idpRes.headers.get('location') as string);
    const code = cb.searchParams.get('code') as string;
    const state = cb.searchParams.get('state') as string;
    expect(code).toBeTruthy();

    // Back at the gateway callback with the transaction cookie.
    const res = await request(app)
      .get(`/api/v1/auth/sso/test/callback?code=${code}&state=${state}`)
      .set('Cookie', txCookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/dashboard');
    // Standard local session was issued.
    expect(res.headers['authorization']).toBeTruthy();
    expect(cookieHeader(res.headers['set-cookie'])).toContain('refreshToken=');
    // The gateway forwarded only validated claims + mapped permissions.
    expect(ApiClient.resolveFederatedUser).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'test',
        email: 'alice@corp.com',
        emailVerified: true,
        suggestedPermissions: [Permission.WRITE_SOME_ENTITY],
      }),
      expect.any(String),
    );
  });

  it('attack: a tampered state is rejected — no session issued', async () => {
    const { txCookie } = await startLogin();

    const res = await request(app)
      .get('/api/v1/auth/sso/test/callback?code=whatever&state=TAMPERED')
      .set('Cookie', txCookie);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?sso_error=1');
    expect(cookieHeader(res.headers['set-cookie'])).not.toContain(
      'refreshToken=',
    );
    expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
  });

  it('attack: callback without the transaction cookie is rejected', async () => {
    const res = await request(app).get(
      '/api/v1/auth/sso/test/callback?code=x&state=y',
    );
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login?sso_error=1');
    expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
  });
});
