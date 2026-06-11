import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@gateway/sso/federated-registry', () => ({
  getFederatedProvider: vi.fn(),
}));
vi.mock('@gateway/sso/saml-client', () => ({
  generateSamlRequestId: vi.fn(() => '_feedfacefeedfacefeedfacefeedface'),
  getSamlClient: vi.fn(),
}));
vi.mock('@gateway/sso/saml-transaction.service', () => ({
  setSamlTransactionCookie: vi.fn(),
  readSamlTransaction: vi.fn(),
  clearSamlTransactionCookie: vi.fn(),
}));
vi.mock('@gateway/sso/saml-logout.service', () => ({
  setSamlLogoutHintCookie: vi.fn(),
}));
vi.mock('@gateway/clients/api.client', () => ({
  ApiClient: { resolveFederatedUser: vi.fn() },
}));
vi.mock('@gateway/middleware/auth.middleware', () => ({
  respondWithTokens: vi.fn(),
}));

import { Permission } from '@dto';
import { ApiClient } from '@gateway/clients/api.client';
import { respondWithTokens } from '@gateway/middleware/auth.middleware';
import { getFederatedProvider } from '@gateway/sso/federated-registry';
import { getSamlClient } from '@gateway/sso/saml-client';
import { setSamlLogoutHintCookie } from '@gateway/sso/saml-logout.service';
import {
  clearSamlTransactionCookie,
  readSamlTransaction,
  setSamlTransactionCookie,
} from '@gateway/sso/saml-transaction.service';
import samlController from './saml.controller';

const samlConfig = {
  id: 'acme',
  displayName: 'Acme',
  entryPoint: 'https://idp.acme.example/sso',
  issuer: 'https://app.example.com',
  emailAttribute: 'email',
  groupsAttribute: 'groups',
  permissionMap: [
    { claim: 'admins', permissions: [Permission.WRITE_SOME_ENTITY] },
  ],
  // Mandatory domain allowlist — the ACS stamps emailVerified:true, so this is
  // the cross-tenant account-takeover boundary.
  allowedDomains: ['acme.com'],
  decryptionPvk: 'SUPER-SECRET-KEY-MATERIAL',
};

const PERSISTENT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent';
const TRANSIENT = 'urn:oasis:names:tc:SAML:2.0:nameid-format:transient';

const mkRes = () => {
  const res = {} as Record<string, ReturnType<typeof vi.fn>>;
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.redirect = vi.fn();
  res.cookie = vi.fn();
  res.type = vi.fn(() => res);
  res.send = vi.fn(() => res);
  return res as never;
};

const samlInstance = {
  getAuthorizeUrlAsync: vi.fn(
    async () => 'https://idp.acme.example/sso?SAMLRequest=abc',
  ),
  generateServiceProviderMetadata: vi.fn(
    () => '<EntityDescriptor entityID="https://app.example.com"/>',
  ),
  validatePostResponseAsync: vi.fn(),
  getLogoutUrlAsync: vi.fn(
    async () => 'https://idp.acme.example/slo?SAMLRequest=xyz',
  ),
  validateRedirectAsync: vi.fn(async () => ({
    profile: null,
    loggedOut: true,
  })),
};

const goodTx = {
  provider: 'acme',
  requestId: '_feedfacefeedfacefeedfacefeedface',
  returnTo: '/dashboard',
};

const goodProfile = {
  issuer: 'https://idp.acme.example/metadata',
  nameID: 'persistent-subject-123',
  nameIDFormat: PERSISTENT,
  inResponseTo: goodTx.requestId,
  sessionIndex: 'sess-1',
  email: 'user@acme.com',
  groups: ['admins'],
};

// samlConfig must declare the IdP issuer the ACS pins against.
Object.assign(samlConfig, { idpIssuer: 'https://idp.acme.example/metadata' });

describe('SamlController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSamlClient).mockReturnValue(samlInstance as never);
    vi.mocked(getFederatedProvider).mockReturnValue({
      protocol: 'saml',
      config: samlConfig,
    } as never);
  });

  describe('login', () => {
    it('404s for an unknown provider without echoing the param', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue(undefined);
      const res = mkRes() as never as {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
      };
      await samlController.login(
        {
          params: { provider: '<script>alert(1)</script>' },
          query: {},
        } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(404);
      expect(JSON.stringify(res.json.mock.calls)).not.toContain('<script>');
      expect(setSamlTransactionCookie).not.toHaveBeenCalled();
    });

    it('404s when the provider exists but is OIDC', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'oidc',
        config: { id: 'okta' },
      } as never);
      const res = mkRes() as never as { status: ReturnType<typeof vi.fn> };
      await samlController.login(
        { params: { provider: 'okta' }, query: {} } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('stores the transaction (cookie, not RelayState) and redirects', async () => {
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.login(
        {
          params: { provider: 'acme' },
          query: { returnTo: '/dashboard' },
        } as never,
        res as never,
      );
      expect(getSamlClient).toHaveBeenCalledWith(
        'acme',
        '_feedfacefeedfacefeedfacefeedface',
      );
      expect(setSamlTransactionCookie).toHaveBeenCalledWith(
        res,
        expect.objectContaining({
          provider: 'acme',
          requestId: '_feedfacefeedfacefeedfacefeedface',
          returnTo: '/dashboard',
        }),
      );
      // RelayState must be empty — returnTo travels only in the signed cookie.
      expect(samlInstance.getAuthorizeUrlAsync).toHaveBeenCalledWith(
        '',
        undefined,
        {},
      );
      expect(res.redirect).toHaveBeenCalledWith(
        'https://idp.acme.example/sso?SAMLRequest=abc',
      );
    });

    it.each(['https://evil.com', '//evil.com', '/\\evil.com'])(
      'neutralises malicious returnTo %s to "/"',
      async (returnTo) => {
        const res = mkRes();
        await samlController.login(
          { params: { provider: 'acme' }, query: { returnTo } } as never,
          res,
        );
        expect(setSamlTransactionCookie).toHaveBeenCalledWith(
          res,
          expect.objectContaining({ returnTo: '/' }),
        );
      },
    );

    it('redirects to the generic error page when the client throws', async () => {
      samlInstance.getAuthorizeUrlAsync.mockRejectedValueOnce(
        new Error('boom'),
      );
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.login(
        { params: { provider: 'acme' }, query: {} } as never,
        res as never,
      );
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });
  });

  describe('callback (ACS)', () => {
    const mkReq = (body = { SAMLResponse: 'b64' }) =>
      ({ params: { provider: 'acme' }, body }) as never;

    beforeEach(() => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.mocked(readSamlTransaction).mockReturnValue(goodTx);
      samlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: { ...goodProfile },
        loggedOut: false,
      });
      vi.mocked(ApiClient.resolveFederatedUser).mockResolvedValue({
        id: 7,
        email: 'user@acme.com',
        permissions: [Permission.READ_SOME_ENTITY],
      } as never);
    });

    it('happy path: validates, resolves, issues tokens, sets SLO hint, redirects', async () => {
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);

      expect(clearSamlTransactionCookie).toHaveBeenCalled(); // single-use
      expect(ApiClient.resolveFederatedUser).toHaveBeenCalledWith(
        {
          provider: 'acme',
          subject: 'persistent-subject-123',
          email: 'user@acme.com',
          emailVerified: true,
          suggestedPermissions: [Permission.WRITE_SOME_ENTITY],
        },
        expect.any(String),
      );
      expect(respondWithTokens).toHaveBeenCalledWith(
        expect.anything(),
        {
          id: 7,
          email: 'user@acme.com',
          permissions: [Permission.READ_SOME_ENTITY],
        },
        expect.objectContaining({ issueRefreshCookie: true }),
      );
      expect(setSamlLogoutHintCookie).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          provider: 'acme',
          nameId: 'persistent-subject-123',
          sessionIndex: 'sess-1',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('rejects without a transaction cookie (IdP-initiated blocked)', async () => {
      vi.mocked(readSamlTransaction).mockReturnValue(null);
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(samlInstance.validatePostResponseAsync).not.toHaveBeenCalled();
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('rejects a transaction bound to a different provider (mix-up)', async () => {
      vi.mocked(readSamlTransaction).mockReturnValue({
        ...goodTx,
        provider: 'other',
      });
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(samlInstance.validatePostResponseAsync).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('rejects a response whose Issuer is a different IdP (mix-up)', async () => {
      samlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: { ...goodProfile, issuer: 'https://evil-idp.example/meta' },
        loggedOut: false,
      });
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('rejects an InResponseTo that does not match the transaction', async () => {
      samlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: { ...goodProfile, inResponseTo: '_someoneelses' },
        loggedOut: false,
      });
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('rejects a transient NameID (unstable identifier)', async () => {
      samlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: { ...goodProfile, nameIDFormat: TRANSIENT },
        loggedOut: false,
      });
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('rejects an invalid signature (validate throws) without leaking detail', async () => {
      samlInstance.validatePostResponseAsync.mockRejectedValue(
        new Error('Invalid signature <xml>secret</xml>'),
      );
      const res = mkRes() as never as {
        redirect: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
      };
      await samlController.callback(mkReq(), res as never);
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
      expect(res.json).not.toHaveBeenCalled();
    });

    it('rejects an email outside the domain allowlist (cross-tenant containment)', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'saml',
        config: { ...samlConfig, allowedDomains: ['acme.com'] },
      } as never);
      samlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: { ...goodProfile, email: 'victim@othertenant.com' },
        loggedOut: false,
      });
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('accepts an allowlisted email and rejects malformed/hostile emails', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'saml',
        config: { ...samlConfig, allowedDomains: ['acme.com'] },
      } as never);
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');

      for (const email of ['not-an-email', 'a@b<script>.com', '']) {
        vi.mocked(ApiClient.resolveFederatedUser).mockClear();
        samlInstance.validatePostResponseAsync.mockResolvedValue({
          profile: { ...goodProfile, email },
          loggedOut: false,
        });
        const res2 = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
        await samlController.callback(mkReq(), res2 as never);
        expect(ApiClient.resolveFederatedUser).not.toHaveBeenCalled();
        expect(res2.redirect).toHaveBeenCalledWith('/login?sso_error=1');
      }
    });

    it('falls back to the NameID as email only for the emailAddress format', async () => {
      samlInstance.validatePostResponseAsync.mockResolvedValue({
        profile: {
          ...goodProfile,
          email: undefined,
          nameID: 'User@Acme.com',
          nameIDFormat:
            'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        },
        loggedOut: false,
      });
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(ApiClient.resolveFederatedUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'user@acme.com' }),
        expect.any(String),
      );
      expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    });

    it('issues no half-session when the api resolve fails', async () => {
      vi.mocked(ApiClient.resolveFederatedUser).mockRejectedValue(
        new Error('api down'),
      );
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(respondWithTokens).not.toHaveBeenCalled();
      expect(setSamlLogoutHintCookie).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('404s for an unknown provider', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue(undefined);
      const res = mkRes() as never as { status: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('sets no SLO hint when token issuance itself fails', async () => {
      vi.mocked(respondWithTokens).mockRejectedValueOnce(new Error('boom'));
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.callback(mkReq(), res as never);
      expect(setSamlLogoutHintCookie).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login?sso_error=1');
    });

    it('clears the transaction cookie even on rejection paths (single-use)', async () => {
      vi.mocked(readSamlTransaction).mockReturnValue(null);
      const res = mkRes();
      await samlController.callback(mkReq(), res);
      expect(clearSamlTransactionCookie).toHaveBeenCalledWith(res);
    });
  });

  describe('sloRedirectUrl', () => {
    const hint = {
      provider: 'acme',
      nameId: 'persistent-subject-123',
      sessionIndex: 'sess-1',
    };

    it('returns null when the provider is unknown, OIDC, or has no logoutUrl', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue(undefined);
      expect(await samlController.sloRedirectUrl(hint, '/')).toBeNull();

      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'oidc',
        config: { id: 'acme' },
      } as never);
      expect(await samlController.sloRedirectUrl(hint, '/')).toBeNull();

      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'saml',
        config: { ...samlConfig, logoutUrl: undefined },
      } as never);
      expect(await samlController.sloRedirectUrl(hint, '/')).toBeNull();
    });

    it('builds the IdP SLO URL with the hint identity and a vetted RelayState', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'saml',
        config: {
          ...samlConfig,
          idpIssuer: 'https://idp.acme.example/metadata',
          logoutUrl: 'https://idp.acme.example/slo',
        },
      } as never);
      const url = await samlController.sloRedirectUrl(
        hint,
        'https://evil.com/phish', // must be neutralised to '/'
      );
      expect(url).toBe('https://idp.acme.example/slo?SAMLRequest=xyz');
      expect(samlInstance.getLogoutUrlAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          nameID: 'persistent-subject-123',
          sessionIndex: 'sess-1',
        }),
        '/', // RelayState sanitised by safeReturnTo
        {},
      );
    });

    it('returns null (best-effort) when URL generation throws', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'saml',
        config: { ...samlConfig, logoutUrl: 'https://idp.acme.example/slo' },
      } as never);
      samlInstance.getLogoutUrlAsync.mockRejectedValueOnce(new Error('down'));
      expect(await samlController.sloRedirectUrl(hint, '/')).toBeNull();
    });
  });

  describe('logoutCallback', () => {
    it('lands on a vetted local path, neutralising external RelayState', async () => {
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.logoutCallback(
        {
          method: 'GET',
          params: { provider: 'acme' },
          query: { SAMLResponse: 'b64', RelayState: 'https://evil.com' },
          originalUrl: '/api/v1/auth/sso/acme/logout/callback?SAMLResponse=b64',
        } as never,
        res as never,
      );
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('an invalid LogoutResponse never breaks the landing', async () => {
      samlInstance.validateRedirectAsync.mockRejectedValueOnce(
        new Error('bad signature'),
      );
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.logoutCallback(
        {
          method: 'GET',
          params: { provider: 'acme' },
          query: { SAMLResponse: 'b64', RelayState: '/login' },
          originalUrl: '/x?SAMLResponse=b64',
        } as never,
        res as never,
      );
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('lands locally even for an unknown provider (no validation possible)', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue(undefined);
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.logoutCallback(
        {
          method: 'GET',
          params: { provider: 'ghost' },
          query: {},
          originalUrl: '/x',
        } as never,
        res as never,
      );
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('validates POST-binding LogoutResponses through the post validator', async () => {
      const res = mkRes() as never as { redirect: ReturnType<typeof vi.fn> };
      await samlController.logoutCallback(
        {
          method: 'POST',
          params: { provider: 'acme' },
          query: {},
          body: { SAMLResponse: 'b64', RelayState: '/done' },
          originalUrl: '/x',
        } as never,
        res as never,
      );
      expect(samlInstance.validatePostResponseAsync).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/done');
    });
  });

  describe('metadata', () => {
    it('404s for unknown or OIDC providers', async () => {
      vi.mocked(getFederatedProvider).mockReturnValue(undefined);
      const res = mkRes() as never as { status: ReturnType<typeof vi.fn> };
      samlController.metadata(
        { params: { provider: 'ghost' } } as never,
        res as never,
      );
      expect(res.status).toHaveBeenCalledWith(404);

      vi.mocked(getFederatedProvider).mockReturnValue({
        protocol: 'oidc',
        config: { id: 'okta' },
      } as never);
      const res2 = mkRes() as never as { status: ReturnType<typeof vi.fn> };
      samlController.metadata(
        { params: { provider: 'okta' } } as never,
        res2 as never,
      );
      expect(res2.status).toHaveBeenCalledWith(404);
    });

    it('serves SP metadata with the SAML content type and no secrets', () => {
      const res = mkRes() as never as {
        type: ReturnType<typeof vi.fn>;
        send: ReturnType<typeof vi.fn>;
      };
      samlController.metadata(
        { params: { provider: 'acme' } } as never,
        res as never,
      );
      // Generated without certs: no signing cert, no decryption cert.
      expect(samlInstance.generateServiceProviderMetadata).toHaveBeenCalledWith(
        null,
        null,
      );
      expect(res.type).toHaveBeenCalledWith('application/samlmetadata+xml');
      const sent = res.send.mock.calls[0][0] as string;
      expect(sent).toContain('EntityDescriptor');
      expect(sent).not.toContain('SUPER-SECRET-KEY-MATERIAL');
    });
  });
});
