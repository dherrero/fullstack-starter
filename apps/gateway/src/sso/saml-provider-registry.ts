import { X509Certificate } from 'node:crypto';
import { ClaimPermissionMapping } from '@dto';
import { SamlProviderConfig } from './saml-types';
import {
  assertSafeFederationUrl,
  buildRegistryFromEnv,
  parsePermissionMap,
} from './provider-registry';

// Detects a SAML provider declaration by its ENTRY_POINT variable.
// id = lowercased capture group, e.g. SAML_OKTA_ENTRY_POINT → "okta".
const SAML_ENV_PREFIX = /^SAML_(.+)_ENTRY_POINT$/;

// How many days before expiry to emit a warning about a cert that is
// about to expire. 30 days gives operators time to rotate without downtime.
const CERT_WARN_DAYS = 30;

const titleCase = (name: string): string =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

// ---------------------------------------------------------------------------
// Certificate normalisation and validation
// ---------------------------------------------------------------------------

/**
 * Normalises a single raw certificate string into a PEM-encoded DER block:
 * - Converts literal `\n` escape sequences to real newlines.
 * - If the value is base64 without PEM armour, wraps it in BEGIN/END headers.
 * Returns the normalised PEM string.
 *
 * Security note: this function MUST NOT log or propagate the cert content
 * in error messages — it only includes the provider id.
 */
const normaliseCertPem = (raw: string): string => {
  // Replace literal backslash-n sequences with real newlines.
  const unescaped = raw.replace(/\\n/g, '\n').trim();

  if (unescaped.startsWith('-----BEGIN')) {
    // Already PEM-armoured — return as-is (normalised whitespace).
    return unescaped;
  }

  // Assume base64 DER without headers; wrap in standard PEM armour.
  // Strip any whitespace that might have been present in the env var.
  const stripped = unescaped.replace(/\s/g, '');
  const lines = stripped.match(/.{1,64}/g)?.join('\n') ?? stripped;
  return `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----`;
};

/**
 * Parses and validates one X.509 certificate PEM for a SAML provider.
 * Throws on parse errors or key weakness. Warns (without logging the cert)
 * when the cert is close to expiry.
 *
 * @param providerId  Used in error/warn messages — never the cert content.
 * @param pem         PEM string (already normalised by {@link normaliseCertPem}).
 */
const validateCert = (providerId: string, pem: string): void => {
  let cert: X509Certificate;
  try {
    cert = new X509Certificate(pem);
  } catch {
    // Do NOT include pem content — it may contain sensitive material or
    // garbage that could be used in a log-injection attack.
    throw new Error(
      `SAML provider "${providerId}" has an unparseable IdP certificate`,
    );
  }

  const now = Date.now();
  const validTo = new Date(cert.validTo).getTime();

  if (validTo < now) {
    throw new Error(
      `SAML provider "${providerId}" IdP certificate has expired (validTo: ${cert.validTo})`,
    );
  }

  const warnThreshold = now + CERT_WARN_DAYS * 24 * 60 * 60 * 1000;
  if (validTo < warnThreshold) {
    // Warning only — expired certs above already throw.
    console.warn(
      `[SAML] Provider "${providerId}": IdP certificate expires in less than ${CERT_WARN_DAYS} days (${cert.validTo}). Rotate it before it expires.`,
    );
  }

  // Enforce a minimum RSA key size. EC/Ed25519/Ed448 keys do not have a modulus
  // and are accepted unconditionally (their strength is not measured in bits).
  const pubKey = cert.publicKey;
  if (
    pubKey.asymmetricKeyType === 'rsa' ||
    pubKey.asymmetricKeyType === 'rsa-pss'
  ) {
    const modulusLength = pubKey.asymmetricKeyDetails?.modulusLength;
    if (modulusLength !== undefined && modulusLength < 2048) {
      throw new Error(
        `SAML provider "${providerId}" IdP certificate uses an RSA key smaller than 2048 bits`,
      );
    }
  }
};

/**
 * Splits a semicolon-separated cert string, normalises each entry, validates
 * each cert independently, and returns the array of PEM strings.
 * Fails fast on the first invalid cert.
 */
const parseIdpCerts = (providerId: string, rawCerts: string): string[] => {
  const entries = rawCerts
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    throw new Error(
      `SAML provider "${providerId}" SAML_${providerId.toUpperCase()}_IDP_CERT is empty`,
    );
  }

  return entries.map((raw) => {
    const pem = normaliseCertPem(raw);
    validateCert(providerId, pem);
    return pem;
  });
};

// ---------------------------------------------------------------------------
// Required / optional env helpers
// ---------------------------------------------------------------------------

const requiredSaml = (
  env: NodeJS.ProcessEnv,
  providerId: string,
  rawName: string,
  key: string,
): string => {
  const varName = `SAML_${rawName}_${key}`;
  const value = env[varName];
  if (!value || !value.trim()) {
    throw new Error(
      `SAML provider "${providerId}" is missing required env ${varName}`,
    );
  }
  return value.trim();
};

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Pure builder: parses and validates every SAML provider declared in the given
 * env object. Throws (fail-fast) on any misconfiguration. Zero providers is
 * valid — SAML simply off. Exported for unit-testing with an explicit env.
 *
 * Provider detection: any `SAML_<NAME>_ENTRY_POINT` variable declares a
 * provider; `NAME` is lowercased to produce the provider id (the primary key
 * stored in `federated_identity.provider`).
 *
 * Id collision: a SAML provider id must not collide with any OIDC provider id
 * declared in the SAME env (same id → same `federated_identity.provider` key →
 * accounts would be mixed across protocols). The builder derives the OIDC id
 * set from the env it receives, so the check is pure and deterministic.
 * SAML↔SAML collisions cannot occur because each `SAML_<NAME>_ENTRY_POINT`
 * key is unique by construction of a `Map`.
 *
 * Security notes:
 * - Cert PEMs and `_DECRYPTION_PVK` are cryptographic secrets; they MUST NOT
 *   appear in error messages, logs, or serialised responses.
 * - Only variable names and provider ids are included in error messages.
 */
export const buildSamlRegistryFromEnv = (
  env: NodeJS.ProcessEnv,
): Map<string, SamlProviderConfig> => {
  const allowInsecure = env.SSO_ALLOW_INSECURE_ISSUERS === 'true';
  const samlRegistry = new Map<string, SamlProviderConfig>();

  // OIDC ids declared in the SAME env — pure, deterministic collision source.
  // Cheap to rebuild; at boot validateSsoConfig() has already vetted this env.
  const oidcIds = new Set(buildRegistryFromEnv(env).keys());

  for (const key of Object.keys(env)) {
    const match = key.match(SAML_ENV_PREFIX);
    if (!match) continue;
    const rawName = match[1]; // e.g. "OKTA", "AZUREAD"
    const id = rawName.toLowerCase(); // e.g. "okta", "azuread"

    // Collision check: the id must not already be claimed by an OIDC provider.
    if (oidcIds.has(id)) {
      throw new Error(
        `SAML provider "${id}" collides with an existing OIDC provider of the same id. ` +
          `Provider ids must be globally unique across all SSO protocols.`,
      );
    }

    // Parse required fields.
    const entryPoint = requiredSaml(env, id, rawName, 'ENTRY_POINT');
    assertSafeFederationUrl(id, entryPoint, allowInsecure, 'entryPoint');

    const idpIssuer = requiredSaml(env, id, rawName, 'IDP_ISSUER');
    const idpCertRaw = requiredSaml(env, id, rawName, 'IDP_CERT');
    const callbackUrl = requiredSaml(env, id, rawName, 'CALLBACK_URL');

    const idpCertPems = parseIdpCerts(id, idpCertRaw);

    // SP issuer defaults to the origin of the callbackUrl. This is predictable
    // and stable: given `https://app.example.com/saml/acme/acs`, the default
    // SP entityID will be `https://app.example.com`. Operators can override
    // with `SAML_<NAME>_SP_ISSUER` if their IdP registration requires a
    // different entityID (e.g. a full metadata URL).
    let defaultSpIssuer: string;
    try {
      defaultSpIssuer = new URL(callbackUrl).origin;
    } catch {
      throw new Error(
        `SAML provider "${id}" has a malformed SAML_${rawName}_CALLBACK_URL`,
      );
    }
    const issuer = env[`SAML_${rawName}_SP_ISSUER`]?.trim() || defaultSpIssuer;

    // Optional logout URL — apply the same SSRF guard as entryPoint.
    const logoutUrlRaw = env[`SAML_${rawName}_LOGOUT_URL`]?.trim();
    if (logoutUrlRaw) {
      assertSafeFederationUrl(id, logoutUrlRaw, allowInsecure, 'logoutUrl');
    }

    // Signature algorithm — only sha256 and sha512 are accepted.
    // sha1 is intentionally excluded (cryptographically broken).
    const sigAlgRaw =
      env[`SAML_${rawName}_SIGNATURE_ALGORITHM`]?.trim() ?? 'sha256';
    if (sigAlgRaw !== 'sha256' && sigAlgRaw !== 'sha512') {
      throw new Error(
        `SAML provider "${id}" has an invalid SAML_${rawName}_SIGNATURE_ALGORITHM: "${sigAlgRaw}". ` +
          `Only "sha256" and "sha512" are accepted (sha1 is disabled).`,
      );
    }
    const signatureAlgorithm = sigAlgRaw as 'sha256' | 'sha512';

    // Allowed domains: CSV, lowercased, stripped of any leading `@`.
    const allowedDomainsRaw = env[`SAML_${rawName}_ALLOWED_DOMAINS`]?.trim();
    const allowedDomains: string[] | undefined = allowedDomainsRaw
      ? allowedDomainsRaw
          .split(',')
          .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
          .filter(Boolean)
      : undefined;

    // Permission map — reuse the shared parser (throws on malformed input).
    const permissionMap: ClaimPermissionMapping[] = parsePermissionMap(
      id,
      env[`SAML_${rawName}_PERMISSION_MAP`],
    );

    // Decryption private key — optional; treated as a secret.
    // Variable name logged in errors; key material never included.
    const decryptionPvk =
      env[`SAML_${rawName}_DECRYPTION_PVK`]?.trim() || undefined;

    // forceAuthn: explicit opt-in only (default false). Instructs the IdP to
    // re-authenticate the user even when it has an active session.
    const forceAuthn = env[`SAML_${rawName}_FORCE_AUTHN`] === 'true';

    // disableRequestedAuthnContext: default true (omit the element) for
    // maximum IdP compat. Set the env var to 'false' to include it.
    const disableRequestedAuthnContextRaw =
      env[`SAML_${rawName}_DISABLE_REQUESTED_AUTHN_CONTEXT`];
    const disableRequestedAuthnContext =
      disableRequestedAuthnContextRaw === 'false' ? false : true;

    samlRegistry.set(id, {
      id,
      displayName: env[`SAML_${rawName}_DISPLAY_NAME`]?.trim() || titleCase(id),
      iconKey: env[`SAML_${rawName}_ICON_KEY`]?.trim() || undefined,
      entryPoint,
      issuer,
      idpIssuer,
      idpCertPems,
      callbackUrl,
      signatureAlgorithm,
      wantAssertionsSigned: true,
      allowedDomains,
      groupsAttribute:
        env[`SAML_${rawName}_GROUPS_ATTRIBUTE`]?.trim() || 'groups',
      emailAttribute: env[`SAML_${rawName}_EMAIL_ATTRIBUTE`]?.trim() || 'email',
      permissionMap,
      logoutUrl: logoutUrlRaw || undefined,
      decryptionPvk,
      forceAuthn,
      disableRequestedAuthnContext,
    });
  }

  return samlRegistry;
};

// ---------------------------------------------------------------------------
// Memoised registry (process.env-backed)
// ---------------------------------------------------------------------------

let cache: Map<string, SamlProviderConfig> | null = null;

const registry = (): Map<string, SamlProviderConfig> => {
  if (!cache) cache = buildSamlRegistryFromEnv(process.env);
  return cache;
};

/** Clears the memoised SAML registry — for tests that mutate `process.env`. */
export const resetSamlRegistryCache = (): void => {
  cache = null;
};

/**
 * Validates the SAML config at boot; throws on any misconfiguration (fail-fast).
 * Zero providers configured is valid — SAML is simply disabled.
 */
export const validateSamlConfig = (): void => {
  cache = buildSamlRegistryFromEnv(process.env);
};

export const getSamlProviderConfig = (
  id: string,
): SamlProviderConfig | undefined => registry().get(id);

export const getAllSamlProviderConfigs = (): SamlProviderConfig[] =>
  Array.from(registry().values());

export const isSamlEnabled = (): boolean => registry().size > 0;
