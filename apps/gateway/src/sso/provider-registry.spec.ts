import { afterEach, describe, expect, it } from 'vitest';
import { Permission } from '@dto';
import {
  buildRegistryFromEnv,
  getProviderConfig,
  isSsoEnabled,
  resetRegistryCache,
} from './provider-registry';
import {
  listPublicProviders,
  resetFederatedRegistryCache,
} from './federated-registry';

const okta = {
  SSO_OKTA_ISSUER: 'https://example.okta.com',
  SSO_OKTA_CLIENT_ID: 'client-okta',
  SSO_OKTA_CLIENT_SECRET: 'secret-okta',
  SSO_OKTA_REDIRECT_URI:
    'https://app.example.com/api/v1/auth/sso/okta/callback',
};

describe('buildRegistryFromEnv', () => {
  it('returns an empty registry when no provider is declared (SSO off)', () => {
    expect(buildRegistryFromEnv({}).size).toBe(0);
  });

  it('parses multiple providers with defaults applied', () => {
    const reg = buildRegistryFromEnv({
      ...okta,
      SSO_AZUREAD_ISSUER: 'https://login.microsoftonline.com/tenant/v2.0',
      SSO_AZUREAD_CLIENT_ID: 'client-az',
      SSO_AZUREAD_CLIENT_SECRET: 'secret-az',
      SSO_AZUREAD_REDIRECT_URI: 'https://app.example.com/cb',
      SSO_AZUREAD_DISPLAY_NAME: 'Microsoft',
    });
    expect([...reg.keys()].sort()).toEqual(['azuread', 'okta']);
    expect(reg.get('okta')?.scopes).toBe('openid profile email');
    expect(reg.get('okta')?.groupsClaim).toBe('groups');
    expect(reg.get('okta')?.displayName).toBe('Okta');
    expect(reg.get('azuread')?.displayName).toBe('Microsoft');
  });

  it('fails fast when a declared provider is missing client_id', () => {
    expect(() =>
      buildRegistryFromEnv({
        SSO_OKTA_ISSUER: 'https://example.okta.com',
        SSO_OKTA_CLIENT_SECRET: 'secret',
        SSO_OKTA_REDIRECT_URI: 'https://app/cb',
      }),
    ).toThrow(/missing required env SSO_OKTA_CLIENT_ID/);
  });

  it('parses a permission map into claim→permissions mappings', () => {
    const reg = buildRegistryFromEnv({
      ...okta,
      SSO_OKTA_PERMISSION_MAP:
        'admins:ADMIN,WRITE_SOME_ENTITY; viewers:READ_SOME_ENTITY',
    });
    expect(reg.get('okta')?.permissionMap).toEqual([
      {
        claim: 'admins',
        permissions: [Permission.ADMIN, Permission.WRITE_SOME_ENTITY],
      },
      { claim: 'viewers', permissions: [Permission.READ_SOME_ENTITY] },
    ]);
  });

  it('fails fast on an unknown permission in the map', () => {
    expect(() =>
      buildRegistryFromEnv({ ...okta, SSO_OKTA_PERMISSION_MAP: 'x:SUPERUSER' }),
    ).toThrow(/unknown permission "SUPERUSER"/);
  });

  describe('SSRF / issuer hardening', () => {
    it('rejects a non-https issuer', () => {
      expect(() =>
        buildRegistryFromEnv({
          ...okta,
          SSO_OKTA_ISSUER: 'http://example.com',
        }),
      ).toThrow(/must use https/);
    });

    it('rejects the cloud metadata / link-local address', () => {
      expect(() =>
        buildRegistryFromEnv({
          ...okta,
          SSO_OKTA_ISSUER: 'https://169.254.169.254/meta',
        }),
      ).toThrow(/not allowed/);
    });

    it('rejects loopback hosts', () => {
      expect(() =>
        buildRegistryFromEnv({ ...okta, SSO_OKTA_ISSUER: 'https://localhost' }),
      ).toThrow(/not allowed/);
      expect(() =>
        buildRegistryFromEnv({ ...okta, SSO_OKTA_ISSUER: 'https://127.0.0.1' }),
      ).toThrow(/not allowed/);
    });

    it('rejects RFC1918 private hosts', () => {
      expect(() =>
        buildRegistryFromEnv({ ...okta, SSO_OKTA_ISSUER: 'https://10.1.2.3' }),
      ).toThrow(/not allowed/);
      expect(() =>
        buildRegistryFromEnv({
          ...okta,
          SSO_OKTA_ISSUER: 'https://192.168.0.5',
        }),
      ).toThrow(/not allowed/);
    });

    it('accepts a public https issuer', () => {
      expect(() => buildRegistryFromEnv(okta)).not.toThrow();
    });

    it('allows insecure/local issuers only behind the explicit dev escape hatch', () => {
      // Dev setups run the IdP on localhost or a private docker network.
      for (const issuer of ['http://localhost:8080', 'https://10.1.2.3']) {
        expect(() =>
          buildRegistryFromEnv({
            ...okta,
            SSO_OKTA_ISSUER: issuer,
            SSO_ALLOW_INSECURE_ISSUERS: 'true',
          }),
        ).not.toThrow();
      }
    });

    it('blocks link-local/cloud-metadata even with the dev escape hatch', () => {
      // Tier-1 block is unconditional — no escape hatch reaches 169.254.x.x.
      for (const issuer of [
        'https://169.254.169.254/meta',
        'http://169.254.169.254/meta',
        'https://0.0.0.0',
      ]) {
        expect(() =>
          buildRegistryFromEnv({
            ...okta,
            SSO_OKTA_ISSUER: issuer,
            SSO_ALLOW_INSECURE_ISSUERS: 'true',
          }),
        ).toThrow(/not allowed/);
      }
    });
  });
});

describe('public accessors (process.env-backed)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetRegistryCache();
    resetFederatedRegistryCache();
  });

  it('listPublicProviders exposes only id/displayName/iconKey — no secrets', () => {
    process.env.SSO_OKTA_ISSUER = okta.SSO_OKTA_ISSUER;
    process.env.SSO_OKTA_CLIENT_ID = okta.SSO_OKTA_CLIENT_ID;
    process.env.SSO_OKTA_CLIENT_SECRET = okta.SSO_OKTA_CLIENT_SECRET;
    process.env.SSO_OKTA_REDIRECT_URI = okta.SSO_OKTA_REDIRECT_URI;
    process.env.SSO_OKTA_ICON_KEY = 'okta-logo';
    resetRegistryCache();

    const list = listPublicProviders();
    expect(list).toEqual([
      {
        id: 'okta',
        displayName: 'Okta',
        iconKey: 'okta-logo',
        protocol: 'oidc',
      },
    ]);
    const serialised = JSON.stringify(list);
    expect(serialised).not.toContain('secret-okta');
    expect(serialised).not.toContain('client-okta');
    expect(serialised).not.toContain(okta.SSO_OKTA_ISSUER);
    expect(isSsoEnabled()).toBe(true);
    expect(getProviderConfig('okta')?.clientSecret).toBe('secret-okta');
  });

  it('reports SSO disabled when no provider is configured', () => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SSO_')) delete process.env[k];
    }
    resetRegistryCache();
    expect(isSsoEnabled()).toBe(false);
    expect(listPublicProviders()).toEqual([]);
  });
});
