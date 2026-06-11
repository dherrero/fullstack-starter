import { randomBytes } from 'node:crypto';
import {
  CacheItem,
  CacheProvider,
  SAML,
  ValidateInResponseTo,
} from '@node-saml/node-saml';
import { getSamlProviderConfig } from './saml-provider-registry';

/**
 * Hard validation bounds. Constants by design — none of these can be relaxed
 * through env configuration:
 * - 30s of clock skew is enough for NTP-synced IdPs; anything larger widens
 *   the replay window.
 * - 10 minutes is a hard ceiling on assertion age regardless of what the
 *   assertion's own Conditions say (defense in depth against lax IdPs).
 */
const ACCEPTED_CLOCK_SKEW_MS = 30_000;
const MAX_ASSERTION_AGE_MS = 10 * 60_000;

/**
 * InResponseTo bookkeeping: node-saml stores the AuthnRequest id when the
 * request is generated and consumes it when the matching response arrives.
 * The TTL mirrors the transaction-cookie TTL (5 min) plus slack, and the
 * entry cap bounds memory so a flood of /login requests cannot OOM the
 * gateway (oldest entries are evicted first).
 */
const REQUEST_ID_TTL_MS = 10 * 60_000;
const REQUEST_CACHE_MAX_ENTRIES = 10_000;

/**
 * Minimal FIFO-bounded, TTL-expiring cache provider for node-saml.
 * The library's own InMemoryCacheProvider is not exported from the package
 * root and has no entry cap; this one is interface-compatible and bounded.
 * NOTE: in-memory state means InResponseTo validation is per-instance; the
 * signed transaction cookie (which also carries the request id) is what keeps
 * the flow stateless across gateway replicas.
 */
class BoundedCacheProvider implements CacheProvider {
  private readonly entries = new Map<
    string,
    { value: string; createdAt: number }
  >();

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    this.pruneExpired();
    if (this.entries.size >= REQUEST_CACHE_MAX_ENTRIES) {
      // FIFO eviction: Map preserves insertion order.
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    const createdAt = Date.now();
    this.entries.set(key, { value, createdAt });
    return { createdAt, value };
  }

  async getAsync(key: string): Promise<string | null> {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.createdAt > REQUEST_ID_TTL_MS) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (key === null || !this.entries.has(key)) return null;
    this.entries.delete(key);
    return key;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > REQUEST_ID_TTL_MS) this.entries.delete(key);
    }
  }
}

// One shared cache per provider so the SAML instance that generates the
// AuthnRequest and the one that validates the response agree on request ids.
const requestCaches = new Map<string, BoundedCacheProvider>();

const cacheFor = (providerId: string): BoundedCacheProvider => {
  let cache = requestCaches.get(providerId);
  if (!cache) {
    cache = new BoundedCacheProvider();
    requestCaches.set(providerId, cache);
  }
  return cache;
};

/**
 * CSPRNG AuthnRequest id. Prefixed with `_` because an xsd:ID must not start
 * with a digit. 128 bits of entropy — unguessable by construction.
 */
export const generateSamlRequestId = (): string =>
  `_${randomBytes(16).toString('hex')}`;

/**
 * Builds a hardened node-saml instance for one provider. Instances are cheap
 * (no I/O in the constructor) and are built per call so a per-request
 * `generateUniqueId` can inject the request id we store in the signed
 * transaction cookie.
 *
 * Security invariants — NONE of these is env-configurable:
 * - `wantAssertionsSigned` + `wantAuthnResponseSigned`: both the Response and
 *   the Assertion must carry a valid signature (anti partial-signing).
 * - signatures verified ONLY against the registry's pinned IdP cert(s) —
 *   never against certificates embedded in the response (trust bypass).
 * - `audience`: AudienceRestriction must equal our SP entityID.
 * - `idpIssuer`: the response Issuer must match the configured IdP
 *   (multi-IdP mix-up defense).
 * - `validateInResponseTo: always`: unsolicited (IdP-initiated) responses are
 *   rejected by design.
 * - persistent NameID format requested; transient is rejected at the ACS.
 */
export const getSamlClient = (providerId: string, requestId?: string): SAML => {
  const config = getSamlProviderConfig(providerId);
  if (!config) throw new Error(`Unknown SAML provider: ${providerId}`);

  return new SAML({
    issuer: config.issuer,
    callbackUrl: config.callbackUrl,
    entryPoint: config.entryPoint,
    idpCert: config.idpCertPems,
    idpIssuer: config.idpIssuer,
    audience: config.issuer,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    signatureAlgorithm: config.signatureAlgorithm,
    digestAlgorithm: config.signatureAlgorithm,
    acceptedClockSkewMs: ACCEPTED_CLOCK_SKEW_MS,
    maxAssertionAgeMs: MAX_ASSERTION_AGE_MS,
    validateInResponseTo: ValidateInResponseTo.always,
    requestIdExpirationPeriodMs: REQUEST_ID_TTL_MS,
    cacheProvider: cacheFor(providerId),
    identifierFormat: 'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
    forceAuthn: config.forceAuthn ?? false,
    disableRequestedAuthnContext: config.disableRequestedAuthnContext ?? true,
    ...(config.decryptionPvk ? { decryptionPvk: config.decryptionPvk } : {}),
    ...(config.logoutUrl ? { logoutUrl: config.logoutUrl } : {}),
    ...(requestId ? { generateUniqueId: () => requestId } : {}),
  });
};

/** Clears the per-provider request-id caches — for tests. */
export const resetSamlClientCaches = (): void => {
  requestCaches.clear();
};
