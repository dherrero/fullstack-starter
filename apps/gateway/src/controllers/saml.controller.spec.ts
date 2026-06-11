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
}));

import { getFederatedProvider } from '@gateway/sso/federated-registry';
import { getSamlClient } from '@gateway/sso/saml-client';
import { setSamlTransactionCookie } from '@gateway/sso/saml-transaction.service';
import samlController from './saml.controller';

const samlConfig = {
  id: 'acme',
  displayName: 'Acme',
  entryPoint: 'https://idp.acme.example/sso',
  issuer: 'https://app.example.com',
  decryptionPvk: 'SUPER-SECRET-KEY-MATERIAL',
};

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
};

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
