import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@dto';

vi.mock('@gateway/sso/provider-registry', () => ({
  getProviderConfig: vi.fn(),
}));
vi.mock('@gateway/sso/federated-registry', () => ({
  listPublicProviders: vi.fn(),
  getFederatedProvider: vi.fn(),
}));
vi.mock('@gateway/controllers/saml.controller', () => ({
  default: { login: vi.fn(), metadata: vi.fn() },
}));
vi.mock('@gateway/sso/discovery', () => ({ getClient: vi.fn() }));
vi.mock('@gateway/clients/api.client', () => ({
  ApiClient: { resolveFederatedUser: vi.fn() },
}));
vi.mock('@gateway/middleware/auth.middleware', () => ({
  respondWithTokens: vi.fn(),
  clearRefreshCookie: vi.fn(),
  revokeCurrentRefreshFamily: vi.fn(),
}));
vi.mock('@gateway/sso/sso-logout.service', () => ({
  setLogoutHintCookie: vi.fn(),
  clearLogoutHintCookie: vi.fn(),
  readLogoutHint: vi.fn(),
}));
vi.mock('@gateway/sso/sso-transaction.service', () => ({
  setTransactionCookie: vi.fn(),
  clearTransactionCookie: vi.fn(),
  readTransaction: vi.fn(),
  safeReturnTo: (v: unknown) =>
    typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/',
}));
vi.mock('openid-client', () => ({
  generators: {
    state: () => 'STATE',
    nonce: () => 'NONCE',
    codeVerifier: () => 'VERIFIER',
    codeChallenge: () => 'CHALLENGE',
  },
}));

import { getProviderConfig } from '@gateway/sso/provider-registry';
import {
  getFederatedProvider,
  listPublicProviders,
} from '@gateway/sso/federated-registry';
import samlController from '@gateway/controllers/saml.controller';
import { getClient } from '@gateway/sso/discovery';
import { ApiClient } from '@gateway/clients/api.client';
import {
  clearRefreshCookie,
  respondWithTokens,
  revokeCurrentRefreshFamily,
} from '@gateway/middleware/auth.middleware';
import {
  clearTransactionCookie,
  readTransaction,
  setTransactionCookie,
} from '@gateway/sso/sso-transaction.service';
import {
  readLogoutHint,
  setLogoutHintCookie,
} from '@gateway/sso/sso-logout.service';
import ssoController from './sso.controller';

const config = {
  id: 'okta',
  displayName: 'Okta',
  issuer: 'https://example.okta.com',
  clientId: 'cid',
  clientSecret: 'secret',
  redirectUri: 'https://app.example.com/api/v1/auth/sso/okta/callback',
  scopes: 'openid profile email',
  groupsClaim: 'groups',
  permissionMap: [
    { claim: 'admins', permissions: [Permission.WRITE_SOME_ENTITY] },
  ],
};

const mkRes = () => {
  const res = {} as Record<string, ReturnType<typeof vi.fn>>;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.redirect = vi.fn();
  res.cookie = vi.fn();
  res.clearCookie = vi.fn();
  res.setHeader = vi.fn();
  return res as never;
};

const client = {
  authorizationUrl: vi.fn(() => 'https://example.okta.com/authorize?x=1'),
  callbackParams: vi.fn(() => ({ code: 'CODE', state: 'STATE' })),
  callback: vi.fn(),
  endSessionUrl: vi.fn(() => 'https://example.okta.com/logout?id_token_hint=x'),
  issuer: {
    metadata: { end_session_endpoint: 'https://example.okta.com/logout' },
  },
};

describe('SsoController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClient).mockResolvedValue(client as never);
  });

  it('providers returns the public provider list', async () => {
    vi.mocked(listPublicProviders).mockReturnValue([
      { id: 'okta', displayName: 'Okta' },
    ]);
    const res = mkRes();
    await ssoController.providers({} as never, res);
    expect(res.json).toHaveBeenCalledWith([
      { id: 'okta', displayName: 'Okta' },
    ]);
  });

  describe('login', () => {
    it('404s for an unknown provider', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue(undefined);
      const res = mkRes();
      await ssoController.login(
        { params: { provider: 'nope' }, query: {} } as never,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(setTransactionCookie).not.toHaveBeenCalled();
    });

    it('dispatches SAML providers to the SAML controller', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'saml',
        config: { id: 'acme' },
      } as never);
      const res = mkRes();
      const req = { params: { provider: 'acme' }, query: {} } as never;
      await ssoController.login(req, res);
      expect(samlController.login).toHaveBeenCalledWith(req, res);
      expect(setTransactionCookie).not.toHaveBeenCalled();
    });

    it('stores the transaction and redirects to the IdP with PKCE S256', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'oidc',
        config,
      } as never);
      const res = mkRes();
      await ssoController.login(
        {
          params: { provider: 'okta' },
          query: { returnTo: '/dashboard' },
        } as never,
        res,
      );
      expect(setTransactionCookie).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          provider: 'okta',
          state: 'STATE',
          nonce: 'NONCE',
          codeVerifier: 'VERIFIER',
          returnTo: '/dashboard',
        }),
      );
      expect(client.authorizationUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          code_challenge: 'CHALLENGE',
          code_challenge_method: 'S256',
          state: 'STATE',
          nonce: 'NONCE',
          redirect_uri: config.redirectUri,
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'https://example.okta.com/authorize?x=1',
      );
    });
  });

  describe('callback', () => {
    const goodTx = {
      provider: 'okta',
      state: 'STATE',
      nonce: 'NONCE',
      codeVerifier: 'VERIFIER',
      returnTo: '/dashboard',
    };

    it('404s for an unknown provider', async () => {
      vi.mocked(getProviderConfig).mockReturnValue(undefined);
      const res = mkRes();
      await ssoController.callback(
        { params: { provider: 'nope' }, query: {}, cookies: {} } as never,
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('redirects to the error page when there is no transaction cookie', async () => {
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      vi.mocked(readTransaction).mockReturnValue(null);
      const res = mkRes();
      await ssoController.callback(
        { params: { provider: 'okta' }, query: {}, cookies: {} } as never,
        res,
      );
      expect(clearTransactionCookie).toHaveBeenCalledWith(res);
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
    });

    it('rejects a transaction started for a different provider (mix-up defense)', async () => {
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      vi.mocked(readTransaction).mockReturnValue({
        ...goodTx,
        provider: 'azuread',
      });
      const res = mkRes();
      await ssoController.callback(
        { params: { provider: 'okta' }, query: {}, cookies: {} } as never,
        res,
      );
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
    });

    it('redirects to error (no leak) when ID-token validation fails', async () => {
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      vi.mocked(readTransaction).mockReturnValue(goodTx);
      client.callback.mockRejectedValueOnce(new Error('nonce mismatch'));
      const res = mkRes();
      await ssoController.callback(
        { params: { provider: 'okta' }, query: {}, cookies: {} } as never,
        res,
      );
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
      expect(respondWithTokens).not.toHaveBeenCalled();
    });

    it('issues a local session on success and redirects to the vetted returnTo', async () => {
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      vi.mocked(readTransaction).mockReturnValue(goodTx);
      client.callback.mockResolvedValueOnce({
        claims: () => ({
          sub: 'okta|1',
          email: 'alice@corp.com',
          email_verified: true,
          groups: ['admins'],
        }),
      });
      vi.mocked(ApiClient.resolveFederatedUser).mockResolvedValue({
        id: 42,
        email: 'alice@corp.com',
        permissions: [Permission.WRITE_SOME_ENTITY],
      });
      const res = mkRes();

      await ssoController.callback(
        { params: { provider: 'okta' }, query: {}, cookies: {} } as never,
        res,
      );

      expect(client.callback).toHaveBeenCalledWith(
        config.redirectUri,
        { code: 'CODE', state: 'STATE' },
        { state: 'STATE', nonce: 'NONCE', code_verifier: 'VERIFIER' },
      );
      expect(ApiClient.resolveFederatedUser).toHaveBeenCalledWith(
        {
          provider: 'okta',
          subject: 'okta|1',
          email: 'alice@corp.com',
          emailVerified: true,
          suggestedPermissions: [Permission.WRITE_SOME_ENTITY],
        },
        expect.any(String),
      );
      expect(respondWithTokens).toHaveBeenCalledWith(
        res,
        {
          id: 42,
          email: 'alice@corp.com',
          permissions: [Permission.WRITE_SOME_ENTITY],
        },
        { issueRefreshCookie: true, requestId: expect.any(String) },
      );
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('stores a logout hint when the IdP returns an id_token', async () => {
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      vi.mocked(readTransaction).mockReturnValue(goodTx);
      client.callback.mockResolvedValueOnce({
        id_token: 'header.payload.sig',
        claims: () => ({
          sub: 'okta|1',
          email: 'alice@corp.com',
          email_verified: true,
          groups: [],
        }),
      });
      vi.mocked(ApiClient.resolveFederatedUser).mockResolvedValue({
        id: 1,
        email: 'alice@corp.com',
        permissions: [Permission.READ_SOME_ENTITY],
      });
      const res = mkRes();
      await ssoController.callback(
        { params: { provider: 'okta' }, query: {}, cookies: {} } as never,
        res,
      );
      expect(setLogoutHintCookie).toHaveBeenCalledWith(res, {
        provider: 'okta',
        idToken: 'header.payload.sig',
      });
    });
  });

  describe('logout', () => {
    it('always revokes the local family and clears cookies', async () => {
      vi.mocked(readLogoutHint).mockReturnValue(null);
      const res = mkRes();
      await ssoController.logout({ query: {}, cookies: {} } as never, res);
      expect(revokeCurrentRefreshFamily).toHaveBeenCalled();
      expect(clearRefreshCookie).toHaveBeenCalledWith(res);
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('redirects to the IdP end_session endpoint for a federated session', async () => {
      vi.mocked(readLogoutHint).mockReturnValue({
        provider: 'okta',
        idToken: 'header.payload.sig',
      });
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      const res = mkRes();
      await ssoController.logout({ query: {}, cookies: {} } as never, res);
      expect(client.endSessionUrl).toHaveBeenCalledWith(
        expect.objectContaining({ id_token_hint: 'header.payload.sig' }),
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'https://example.okta.com/logout?id_token_hint=x',
      );
    });

    it('falls back to a local redirect when the IdP lookup fails', async () => {
      vi.mocked(readLogoutHint).mockReturnValue({
        provider: 'okta',
        idToken: 'tok',
      });
      vi.mocked(getProviderConfig).mockReturnValue(config as never);
      vi.mocked(getClient).mockRejectedValueOnce(new Error('idp down'));
      const res = mkRes();
      await ssoController.logout(
        { query: { returnTo: '/bye' }, cookies: {} } as never,
        res,
      );
      expect(clearRefreshCookie).toHaveBeenCalledWith(res);
      expect(res.redirect).toHaveBeenCalledWith('/bye');
    });
  });
});
