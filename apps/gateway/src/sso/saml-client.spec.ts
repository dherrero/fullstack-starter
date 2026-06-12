import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidateInResponseTo } from '@node-saml/node-saml';
import {
  generateSamlRequestId,
  getSamlClient,
  resetSamlClientCaches,
} from './saml-client';
import { getSamlProviderConfig } from './saml-provider-registry';
import type { SamlProviderConfig } from './saml-types';

vi.mock('./saml-provider-registry', () => ({
  getSamlProviderConfig: vi.fn(),
}));

const baseConfig: SamlProviderConfig = {
  id: 'acme',
  displayName: 'Acme',
  entryPoint: 'https://idp.acme.example/sso',
  issuer: 'https://app.example.com',
  idpIssuer: 'https://idp.acme.example/metadata',
  idpCertPems: ['-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----'],
  callbackUrl: 'https://app.example.com/api/v1/auth/sso/acme/callback',
  signatureAlgorithm: 'sha256',
  wantAssertionsSigned: true,
  groupsAttribute: 'groups',
  emailAttribute: 'email',
  permissionMap: [],
};

describe('generateSamlRequestId', () => {
  it('produces unique, CSPRNG, xsd:ID-safe identifiers', () => {
    const ids = new Set(
      Array.from({ length: 100 }, () => generateSamlRequestId()),
    );
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^_[0-9a-f]{32}$/);
  });
});

describe('getSamlClient', () => {
  beforeEach(() => {
    vi.mocked(getSamlProviderConfig).mockReturnValue(baseConfig);
  });
  afterEach(() => {
    vi.clearAllMocks();
    resetSamlClientCaches();
  });

  it('throws for an unknown provider', () => {
    vi.mocked(getSamlProviderConfig).mockReturnValue(undefined);
    expect(() => getSamlClient('ghost')).toThrow(/Unknown SAML provider/);
  });

  it('builds a hardened instance — none of the invariants relaxed', () => {
    const saml = getSamlClient('acme');
    const options = saml.options;
    expect(options.wantAssertionsSigned).toBe(true);
    expect(options.wantAuthnResponseSigned).toBe(true);
    expect(options.validateInResponseTo).toBe(ValidateInResponseTo.always);
    expect(options.audience).toBe(baseConfig.issuer);
    expect(options.idpIssuer).toBe(baseConfig.idpIssuer);
    expect(options.idpCert).toEqual(baseConfig.idpCertPems);
    expect(options.signatureAlgorithm).toBe('sha256');
    expect(options.digestAlgorithm).toBe('sha256');
    expect(options.acceptedClockSkewMs).toBeLessThanOrEqual(30_000);
    expect(options.maxAssertionAgeMs).toBeLessThanOrEqual(10 * 60_000);
    expect(options.identifierFormat).toBe(
      'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    );
    expect(options.forceAuthn).toBe(false);
    expect(options.disableRequestedAuthnContext).toBe(true);
  });

  it('honours per-provider forceAuthn / disableRequestedAuthnContext', () => {
    vi.mocked(getSamlProviderConfig).mockReturnValue({
      ...baseConfig,
      forceAuthn: true,
      disableRequestedAuthnContext: false,
    });
    const options = getSamlClient('acme').options;
    expect(options.forceAuthn).toBe(true);
    expect(options.disableRequestedAuthnContext).toBe(false);
  });

  it('injects the provided request id as the AuthnRequest ID generator', () => {
    const saml = getSamlClient('acme', '_feedfacefeedfacefeedfacefeedface');
    expect(saml.options.generateUniqueId()).toBe(
      '_feedfacefeedfacefeedfacefeedface',
    );
  });

  it('shares one request-id cache across instances of the same provider', async () => {
    const a = getSamlClient('acme', '_id1');
    const b = getSamlClient('acme');
    await a.options.cacheProvider.saveAsync('_id1', 'ts');
    expect(await b.options.cacheProvider.getAsync('_id1')).toBe('ts');
    // Different provider → different cache.
    vi.mocked(getSamlProviderConfig).mockReturnValue({
      ...baseConfig,
      id: 'other',
    });
    const c = getSamlClient('other');
    expect(await c.options.cacheProvider.getAsync('_id1')).toBeNull();
  });

  it('generates a real redirect URL: deflate+base64 SAMLRequest with our ID', async () => {
    const { inflateRawSync } = await import('node:zlib');
    const requestId = generateSamlRequestId();
    const saml = getSamlClient('acme', requestId);
    const url = new URL(await saml.getAuthorizeUrlAsync('', undefined, {}));

    expect(url.origin + url.pathname).toBe(baseConfig.entryPoint);
    const raw = url.searchParams.get('SAMLRequest');
    expect(raw).toBeTruthy();
    const xml = inflateRawSync(Buffer.from(raw as string, 'base64')).toString(
      'utf8',
    );
    expect(xml).toContain(`ID="${requestId}"`);
    expect(xml).toContain(`Destination="${baseConfig.entryPoint}"`);
    expect(xml).toContain(baseConfig.issuer); // SP entityID as Issuer
    expect(xml).toContain(
      'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    );
    expect(xml).not.toContain('ForceAuthn'); // off by default
    // RelayState empty → not in the query at all.
    expect(url.searchParams.get('RelayState')).toBeFalsy();
  });

  it('request-id cache entries are single-use via removeAsync', async () => {
    const saml = getSamlClient('acme');
    const cache = saml.options.cacheProvider;
    await cache.saveAsync('_x', 'ts');
    expect(await cache.removeAsync('_x')).toBe('_x');
    expect(await cache.getAsync('_x')).toBeNull();
    expect(await cache.removeAsync('_x')).toBeNull();
  });
});
