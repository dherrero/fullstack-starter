import { afterEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@dto';
import {
  buildSamlRegistryFromEnv,
  getSamlProviderConfig,
  isSamlEnabled,
  resetSamlRegistryCache,
} from './saml-provider-registry';
import { resetRegistryCache } from './provider-registry';
import {
  getFederatedProvider,
  isFederationEnabled,
  listPublicProviders,
  resetFederatedRegistryCache,
} from './federated-registry';

// ---------------------------------------------------------------------------
// Test-only X.509 fixtures. Self-signed throwaway certs generated exclusively
// for this spec — the private keys were discarded and are not reused anywhere.
// ---------------------------------------------------------------------------

// RSA-2048, CN=test-idp-valid, expires 2100-05-14.
const VALID_CERT = `-----BEGIN CERTIFICATE-----
MIICsDCCAZgCCQDZWwknp3ogYzANBgkqhkiG9w0BAQsFADAZMRcwFQYDVQQDDA50
ZXN0LWlkcC12YWxpZDAgFw0yNjA2MTEwODE2MTRaGA8yMTAwMDUxNDA4MTYxNFow
GTEXMBUGA1UEAwwOdGVzdC1pZHAtdmFsaWQwggEiMA0GCSqGSIb3DQEBAQUAA4IB
DwAwggEKAoIBAQCyVQEMEZSUOzo0xgDLU8EF2I5bFPCzfEPinC/BlYa3RCo0fnWN
r4ZPEfExEMU7nDos+K6i4mApA0vYCdkY+jFA0yB4OKYLMTKd4n29t2PAqkevLu/R
r5sZ+0bVe28+ciDzMNcG/B4JCJncCy+QWn8xdcf8LNg5bCOWLeOMAbZkDepuAIW2
72grFEtcFH/x3UIBiVRw8Uu8U45SJkL/cQnkJDAteJ1ELoRL+2U2DuH5xn2C4jiJ
D87Sq2MpkLml+YmeXi440g1362iDyROWvRqKI8fGvG4stXKKuqcoKy708JSdHKfs
FvmB4wXGwzBuoy0g2xy63KICNzimbcKCjfJfAgMBAAEwDQYJKoZIhvcNAQELBQAD
ggEBAGrPTol7VQM4SMa1lLsasJwVW9fo7+09g27EZB+nh0B2kd3nNvAJRRM5GJDe
1o/pXAnBxp/tzQZvI8slUPFDDMYXXT4K5MKsrF3emOeT3UIQK5Uff1cRU9OG71mo
7Zukzb03OcJg8bodq0ZNWk7PjhLScyNMUQpWUJHpgDyglFWGplcmLzDNrh8e1r1g
s+qRBG+cf9/8cvuybkIKbnj6h0jNC6mPXfBp3ZVVWLZyNVrTJDENyYl6FLB3hKix
gevtFdPJ/xebLkJaqvRe0ibT4Zt+JtNmvHHI+/uBrLOPv2DCkhmeteR6hyofubhb
5UPyV34+IaicTy7s3W7E1BKe+vQ=
-----END CERTIFICATE-----`;

// RSA-1024 (intentionally weak), CN=test-idp-weak, expires 2100-05-14.
const WEAK_CERT = `-----BEGIN CERTIFICATE-----
MIIBqTCCARICCQD/4XvlccaiGzANBgkqhkiG9w0BAQsFADAYMRYwFAYDVQQDDA10
ZXN0LWlkcC13ZWFrMCAXDTI2MDYxMTA4MTYxNFoYDzIxMDAwNTE0MDgxNjE0WjAY
MRYwFAYDVQQDDA10ZXN0LWlkcC13ZWFrMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCB
iQKBgQDlihgn9fviMnDEU/yJzVKTdZKWZJajp8f2FGVfiziuhkZk0f77WX2GZPn/
FQ6deO85vxccksirrgU/lNpDgCCZDhGsRMOzMK/KAwpy+bSe2YcrG1QOt0r9WrmT
gkP5h1NHydtpWs+truO5lSMCffJFRFaBjXQsF6GhRDMJXH05zQIDAQABMA0GCSqG
SIb3DQEBCwUAA4GBAN3sAfSDjFw7k8x6q4iC4dkwGZchgNWZLcGwB8JoYuCPUxXM
ZZ994nOU7W1GiUhDi5w3xob8EBt24F1WfUmWAf7IxW1z+xpiMcvnO/SA/0kBPowv
FdFXrjAK84R5ZC5JqboXOy9hX6dl61G8EEv0eMjxmZB8GY/maQ01fWVUnOI+
-----END CERTIFICATE-----`;

// RSA-2048, CN=test-idp-expired, expires 2026-07-11. Used with fake timers to
// exercise both the "expires soon" warning and the "expired" rejection paths.
const SHORT_LIVED_CERT = `-----BEGIN CERTIFICATE-----
MIICsjCCAZoCCQDH15vWUmOnXTANBgkqhkiG9w0BAQsFADAbMRkwFwYDVQQDDBB0
ZXN0LWlkcC1leHBpcmVkMB4XDTI2MDYxMTA4MTYxNFoXDTI2MDcxMTA4MTYxNFow
GzEZMBcGA1UEAwwQdGVzdC1pZHAtZXhwaXJlZDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMijQeLeLTYq8dUmhVlMdEQcWmVimqaBvvHw8pqIERoybYGJ
kAF0BYkibRSpp5RImwKfDQ8wpJm7zZ2NKjhxUqingv+98CMpee5V9ScEJw2NFpr2
83pP34ebC9k3WZIUXVSukpMPJ8Exc5nzBxDQB5WO34Z28lG4oSHsXi2zUpgBDyWX
T217rNJGF3+bVrMqq2fK/DTuZHD1gDmzYhPdmiDG38OpP+BmxgqEU/35d4AYYV32
HbDX9z31wW2SWePJT2BJia0s6MQfx6hphur+uys/gH6hDGOgEsZgJhsV5Q0rBeMw
yWnxiJPqAU6vRa+EvkFxXipeDxIXNEMFGuztsJkCAwEAATANBgkqhkiG9w0BAQsF
AAOCAQEAl9GB9G+okid+Uxsz2ffkYhcCc74OIglgfJW6nj3SndIPz+YdLIypUTUi
R7K4hByEYLSkqsOzW6BPO70/pjSO8/fBMHZAGii3+/C9vO+NtcWGiJma/Q0cMmpo
yomznNgGfQ7cyOk6NU7/XMhUaYg+Imz79AHifpb3ICobtPVbpXJl2wLmKa1V6QBY
3VSwcKj312u5TiuabgeRjNQ88WjMjpvf2LN2asqNh+dE3mI+R/MqpS1Z2BZFG3lp
3CvBa7d8l9QBZPz9vYZF6nGOmHND5Mm3SnAy4bjo5bybYcEZPxgaA2nJlhYF2Nvt
DLWV7xOOxFpksznY/IbJU4aoyPbeCA==
-----END CERTIFICATE-----`;

const acme = {
  SAML_ACME_ENTRY_POINT: 'https://idp.acme.example/sso/saml',
  SAML_ACME_IDP_ISSUER: 'https://idp.acme.example/metadata',
  SAML_ACME_IDP_CERT: VALID_CERT,
  SAML_ACME_CALLBACK_URL:
    'https://app.example.com/api/v1/auth/sso/acme/callback',
};

const oktaOidc = {
  SSO_OKTA_ISSUER: 'https://example.okta.com',
  SSO_OKTA_CLIENT_ID: 'client-okta',
  SSO_OKTA_CLIENT_SECRET: 'secret-okta',
  SSO_OKTA_REDIRECT_URI:
    'https://app.example.com/api/v1/auth/sso/okta/callback',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('buildSamlRegistryFromEnv', () => {
  it('returns an empty registry when no provider is declared (SAML off)', () => {
    expect(buildSamlRegistryFromEnv({}).size).toBe(0);
  });

  it('parses a provider with defaults applied', () => {
    const reg = buildSamlRegistryFromEnv(acme);
    const cfg = reg.get('acme');
    expect(cfg).toBeDefined();
    expect(cfg?.displayName).toBe('Acme');
    expect(cfg?.entryPoint).toBe(acme.SAML_ACME_ENTRY_POINT);
    expect(cfg?.idpIssuer).toBe(acme.SAML_ACME_IDP_ISSUER);
    // SP entityID defaults to the origin of the callback URL.
    expect(cfg?.issuer).toBe('https://app.example.com');
    expect(cfg?.emailAttribute).toBe('email');
    expect(cfg?.groupsAttribute).toBe('groups');
    expect(cfg?.signatureAlgorithm).toBe('sha256');
    expect(cfg?.wantAssertionsSigned).toBe(true);
    expect(cfg?.idpCertPems).toHaveLength(1);
    expect(cfg?.allowedDomains).toBeUndefined();
    expect(cfg?.logoutUrl).toBeUndefined();
    expect(cfg?.decryptionPvk).toBeUndefined();
    expect(cfg?.forceAuthn).toBe(false);
    expect(cfg?.disableRequestedAuthnContext).toBe(true);
  });

  it('honours every optional override', () => {
    const reg = buildSamlRegistryFromEnv({
      ...acme,
      SAML_ACME_SP_ISSUER: 'https://app.example.com/saml/metadata',
      SAML_ACME_DISPLAY_NAME: 'Acme Corp',
      SAML_ACME_ICON_KEY: 'acme-logo',
      SAML_ACME_EMAIL_ATTRIBUTE: 'mail',
      SAML_ACME_GROUPS_ATTRIBUTE: 'memberOf',
      SAML_ACME_SIGNATURE_ALGORITHM: 'sha512',
      SAML_ACME_LOGOUT_URL: 'https://idp.acme.example/slo',
      SAML_ACME_ALLOWED_DOMAINS: ' @Acme.com , corp.io ',
      SAML_ACME_PERMISSION_MAP: 'admins:ADMIN;viewers:READ_SOME_ENTITY',
      SAML_ACME_DECRYPTION_PVK: 'test-placeholder-not-a-real-key',
      SAML_ACME_FORCE_AUTHN: 'true',
      SAML_ACME_DISABLE_REQUESTED_AUTHN_CONTEXT: 'false',
    });
    const cfg = reg.get('acme');
    expect(cfg?.issuer).toBe('https://app.example.com/saml/metadata');
    expect(cfg?.displayName).toBe('Acme Corp');
    expect(cfg?.iconKey).toBe('acme-logo');
    expect(cfg?.emailAttribute).toBe('mail');
    expect(cfg?.groupsAttribute).toBe('memberOf');
    expect(cfg?.signatureAlgorithm).toBe('sha512');
    expect(cfg?.logoutUrl).toBe('https://idp.acme.example/slo');
    expect(cfg?.allowedDomains).toEqual(['acme.com', 'corp.io']);
    expect(cfg?.permissionMap).toEqual([
      { claim: 'admins', permissions: [Permission.ADMIN] },
      { claim: 'viewers', permissions: [Permission.READ_SOME_ENTITY] },
    ]);
    expect(cfg?.decryptionPvk).toBe('test-placeholder-not-a-real-key');
    expect(cfg?.forceAuthn).toBe(true);
    expect(cfg?.disableRequestedAuthnContext).toBe(false);
  });

  it.each(['IDP_ISSUER', 'IDP_CERT', 'CALLBACK_URL'] as const)(
    'fails fast when a declared provider is missing %s',
    (key) => {
      const env: NodeJS.ProcessEnv = { ...acme };
      delete env[`SAML_ACME_${key}`];
      expect(() => buildSamlRegistryFromEnv(env)).toThrow(
        new RegExp(`missing required env SAML_ACME_${key}`),
      );
    },
  );

  it('rejects an invalid signature algorithm (sha1 is disabled)', () => {
    expect(() =>
      buildSamlRegistryFromEnv({
        ...acme,
        SAML_ACME_SIGNATURE_ALGORITHM: 'sha1',
      }),
    ).toThrow(/Only "sha256" and "sha512" are accepted/);
  });

  it('fails fast on a malformed permission map (never grants silently)', () => {
    expect(() =>
      buildSamlRegistryFromEnv({
        ...acme,
        SAML_ACME_PERMISSION_MAP: 'x:SUPERUSER',
      }),
    ).toThrow(/unknown permission "SUPERUSER"/);
  });

  describe('certificate validation', () => {
    it('rejects an unparseable certificate without echoing its content', () => {
      let message = '';
      try {
        buildSamlRegistryFromEnv({
          ...acme,
          SAML_ACME_IDP_CERT: 'bm90LWEtY2VydA==',
        });
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/unparseable IdP certificate/);
      expect(message).not.toContain('bm90LWEtY2VydA');
    });

    it('rejects an expired certificate', () => {
      vi.useFakeTimers();
      // 2026-08-01: SHORT_LIVED_CERT (validTo 2026-07-11) is expired.
      vi.setSystemTime(new Date('2026-08-01T00:00:00Z'));
      expect(() =>
        buildSamlRegistryFromEnv({
          ...acme,
          SAML_ACME_IDP_CERT: SHORT_LIVED_CERT,
        }),
      ).toThrow(/certificate has expired/);
    });

    it('warns (but accepts) a certificate expiring in <30 days', () => {
      vi.useFakeTimers();
      // 2026-06-15: SHORT_LIVED_CERT expires 2026-07-11 → 26 days left.
      vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));
      const warn = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);
      const reg = buildSamlRegistryFromEnv({
        ...acme,
        SAML_ACME_IDP_CERT: SHORT_LIVED_CERT,
      });
      expect(reg.get('acme')?.idpCertPems).toHaveLength(1);
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).not.toContain('BEGIN CERTIFICATE');
    });

    it('rejects an RSA key smaller than 2048 bits', () => {
      expect(() =>
        buildSamlRegistryFromEnv({ ...acme, SAML_ACME_IDP_CERT: WEAK_CERT }),
      ).toThrow(/RSA key smaller than 2048 bits/);
    });

    it('supports multi-cert rotation via the ";" separator', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-06-15T00:00:00Z'));
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const reg = buildSamlRegistryFromEnv({
        ...acme,
        SAML_ACME_IDP_CERT: `${VALID_CERT};${SHORT_LIVED_CERT}`,
      });
      expect(reg.get('acme')?.idpCertPems).toHaveLength(2);
    });

    it('normalises bare base64 (no PEM armour) and literal \\n escapes', () => {
      const bare = VALID_CERT.replace(
        /-----(BEGIN|END) CERTIFICATE-----/g,
        '',
      ).replace(/\s/g, '');
      const escaped = VALID_CERT.replace(/\n/g, '\\n');
      for (const variant of [bare, escaped]) {
        const reg = buildSamlRegistryFromEnv({
          ...acme,
          SAML_ACME_IDP_CERT: variant,
        });
        const pems = reg.get('acme')?.idpCertPems ?? [];
        expect(pems).toHaveLength(1);
        expect(pems[0]).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
      }
    });
  });

  describe('id collisions across protocols', () => {
    it('rejects a SAML provider whose id collides with an OIDC provider', () => {
      expect(() =>
        buildSamlRegistryFromEnv({
          ...oktaOidc,
          SAML_OKTA_ENTRY_POINT: 'https://idp.okta.example/sso',
          SAML_OKTA_IDP_ISSUER: 'https://idp.okta.example/metadata',
          SAML_OKTA_IDP_CERT: VALID_CERT,
          SAML_OKTA_CALLBACK_URL: 'https://app.example.com/cb',
        }),
      ).toThrow(/collides with an existing OIDC provider/);
    });
  });

  describe('SSRF / federation-URL hardening', () => {
    it('rejects a non-https entryPoint', () => {
      expect(() =>
        buildSamlRegistryFromEnv({
          ...acme,
          SAML_ACME_ENTRY_POINT: 'http://idp.acme.example/sso',
        }),
      ).toThrow(/must use https/);
    });

    it('rejects loopback, link-local and RFC1918 entryPoints', () => {
      for (const host of [
        'https://localhost/sso',
        'https://169.254.169.254/sso',
        'https://10.1.2.3/sso',
        'https://192.168.0.5/sso',
      ]) {
        expect(() =>
          buildSamlRegistryFromEnv({ ...acme, SAML_ACME_ENTRY_POINT: host }),
        ).toThrow(/not allowed/);
      }
    });

    it('applies the same guard to the optional logoutUrl', () => {
      expect(() =>
        buildSamlRegistryFromEnv({
          ...acme,
          SAML_ACME_LOGOUT_URL: 'https://169.254.169.254/slo',
        }),
      ).toThrow(/not allowed/);
    });

    it('allows insecure/local entryPoints only behind the explicit dev escape hatch', () => {
      // Dev setups run the IdP on localhost or a private docker network.
      for (const entryPoint of [
        'http://localhost:8443/sso',
        'https://10.1.2.3/sso',
      ]) {
        expect(() =>
          buildSamlRegistryFromEnv({
            ...acme,
            SAML_ACME_ENTRY_POINT: entryPoint,
            SSO_ALLOW_INSECURE_ISSUERS: 'true',
          }),
        ).not.toThrow();
      }
    });

    it('blocks link-local/cloud-metadata even with the dev escape hatch', () => {
      // Tier-1 block is unconditional — no escape hatch reaches 169.254.x.x.
      for (const entryPoint of [
        'https://169.254.169.254/sso',
        'http://169.254.169.254/sso',
        'https://0.0.0.0/sso',
      ]) {
        expect(() =>
          buildSamlRegistryFromEnv({
            ...acme,
            SAML_ACME_ENTRY_POINT: entryPoint,
            SSO_ALLOW_INSECURE_ISSUERS: 'true',
          }),
        ).toThrow(/not allowed/);
      }
    });
  });
});

describe('federated registry (process.env-backed)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    resetRegistryCache();
    resetSamlRegistryCache();
    resetFederatedRegistryCache();
  });

  const configureMixedEnv = () => {
    Object.assign(process.env, oktaOidc, acme);
    resetRegistryCache();
    resetSamlRegistryCache();
  };

  it('lists OIDC and SAML providers mixed, protocol-tagged and id-sorted', () => {
    configureMixedEnv();
    expect(listPublicProviders()).toEqual([
      { id: 'acme', displayName: 'Acme', iconKey: undefined, protocol: 'saml' },
      {
        id: 'okta',
        displayName: 'Okta',
        iconKey: undefined,
        protocol: 'oidc',
      },
    ]);
  });

  it('never leaks certificates or secrets through the public list', () => {
    configureMixedEnv();
    const serialised = JSON.stringify(listPublicProviders());
    expect(serialised).not.toContain('CERTIFICATE');
    expect(serialised).not.toContain('secret-okta');
    expect(serialised).not.toContain('idp.acme.example');
  });

  it('getFederatedProvider discriminates protocols and misses safely', () => {
    configureMixedEnv();
    const saml = getFederatedProvider('acme');
    expect(saml?.protocol).toBe('saml');
    if (saml?.protocol === 'saml') {
      expect(saml.config.entryPoint).toBe(acme.SAML_ACME_ENTRY_POINT);
    }
    const oidc = getFederatedProvider('okta');
    expect(oidc?.protocol).toBe('oidc');
    if (oidc?.protocol === 'oidc') {
      expect(oidc.config.clientId).toBe('client-okta');
    }
    expect(getFederatedProvider('ghost')).toBeUndefined();
  });

  it('reports federation enabled when either protocol has providers', () => {
    for (const k of Object.keys(process.env)) {
      if (k.startsWith('SSO_') || k.startsWith('SAML_')) delete process.env[k];
    }
    resetRegistryCache();
    resetSamlRegistryCache();
    expect(isFederationEnabled()).toBe(false);
    expect(isSamlEnabled()).toBe(false);

    Object.assign(process.env, acme);
    resetRegistryCache();
    resetSamlRegistryCache();
    expect(isFederationEnabled()).toBe(true);
    expect(isSamlEnabled()).toBe(true);
    expect(getSamlProviderConfig('acme')?.idpCertPems).toHaveLength(1);
  });
});
