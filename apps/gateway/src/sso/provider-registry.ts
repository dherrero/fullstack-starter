import { ClaimPermissionMapping, Permission } from '@dto';
// SsoProviderPublicDTO intentionally not imported here — the unified public
// surface lives in federated-registry.ts, which owns listPublicProviders().

/**
 * Full, secret-bearing configuration of one OIDC provider. Lives ONLY in the
 * gateway — never serialised to the client. Use the federated registry's
 * `listPublicProviders` for anything the browser may see.
 */
export interface SsoProviderConfig {
  /** Lowercased provider key, used in `/auth/sso/:id/login`. */
  id: string;
  displayName: string;
  iconKey?: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Optional RP-initiated-logout return URL (registered at the IdP). */
  postLogoutRedirectUri?: string;
  scopes: string;
  groupsClaim: string;
  permissionMap: ClaimPermissionMapping[];
}

const ENV_PREFIX = /^SSO_(.+)_ISSUER$/;

// SSRF defense, two tiers:
// - ALWAYS blocked, even with the dev escape-hatch: link-local (incl. the
//   169.254.169.254 cloud metadata endpoint) and 0.0.0.0/"this host". There is
//   no legitimate federation scenario — dev included — pointing at those.
// - Blocked unless the dev escape-hatch is active: loopback and RFC1918
//   ranges. Dev setups legitimately run the IdP on localhost or a private
//   docker network; production must never set SSO_ALLOW_INSECURE_ISSUERS.
const parseIpv4 = (h: string): [number, number] | null => {
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return ipv4 ? [Number(ipv4[1]), Number(ipv4[2])] : null;
};

const isAlwaysBlockedHost = (host: string): boolean => {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === '0.0.0.0') return true;
  const ip = parseIpv4(h);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 0) return true; // "this host"
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  return false;
};

const isPrivateHost = (host: string): boolean => {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h === '::1') return true;
  const ip = parseIpv4(h);
  if (!ip) return false;
  const [a, b] = ip;
  if (a === 127 || a === 10) return true; // loopback / private
  if (a === 192 && b === 168) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  return false;
};

/**
 * SSRF guard for any federation URL (OIDC issuer, SAML entryPoint, logoutUrl…).
 * Enforces https and blocks loopback/RFC1918 destinations, except when the dev
 * escape-hatch (`SSO_ALLOW_INSECURE_ISSUERS=true`) is active — dev setups run
 * IdPs on localhost/private networks. Link-local (cloud metadata) and 0.0.0.0
 * are blocked UNCONDITIONALLY: the escape hatch never opens those.
 *
 * @param providerId  Provider id included in error messages (never the URL value).
 * @param url         The URL to validate.
 * @param allowInsecure  Set to true only in dev (`SSO_ALLOW_INSECURE_ISSUERS=true`).
 * @param label       Human-readable field name for the error message (e.g. "issuer",
 *                    "entryPoint", "logoutUrl").
 */
export const assertSafeFederationUrl = (
  providerId: string,
  url: string,
  allowInsecure: boolean,
  label = 'url',
): void => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `SSO provider "${providerId}" has a malformed ${label} URL`,
    );
  }
  // Tier 1 — unconditional: cloud-metadata/link-local/0.0.0.0 are never a
  // legitimate federation target, not even in dev.
  if (isAlwaysBlockedHost(parsed.hostname)) {
    throw new Error(
      `SSO provider "${providerId}" ${label} host is not allowed (link-local/metadata)`,
    );
  }
  if (parsed.protocol !== 'https:') {
    if (allowInsecure && parsed.protocol === 'http:') return;
    throw new Error(
      `SSO provider "${providerId}" ${label} must use https (got ${parsed.protocol})`,
    );
  }
  // Tier 2 — loopback/RFC1918: blocked unless the explicit dev escape hatch.
  if (!allowInsecure && isPrivateHost(parsed.hostname)) {
    throw new Error(
      `SSO provider "${providerId}" ${label} host is not allowed (loopback/link-local/private)`,
    );
  }
};

// Internal alias kept for backward-compatibility within this module.
const assertSafeIssuer = (
  providerId: string,
  issuer: string,
  allowInsecure: boolean,
): void => assertSafeFederationUrl(providerId, issuer, allowInsecure, 'issuer');

/**
 * Parses a raw permission-map string (`claim:PERM1,PERM2;…`) into structured
 * mappings. Unknown permissions and malformed entries are a fatal misconfiguration
 * — this function throws so they are caught at boot, never granted silently.
 *
 * @param providerId  Included in error messages; must not contain secret material.
 * @param raw         The raw env-var value, or `undefined` when the var is absent.
 */
export const parsePermissionMap = (
  providerId: string,
  raw: string | undefined,
): ClaimPermissionMapping[] => {
  if (!raw || !raw.trim()) return [];
  const allowed = Object.values(Permission) as string[];
  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(':');
      const claim = sep >= 0 ? entry.slice(0, sep).trim() : '';
      const permsRaw = sep >= 0 ? entry.slice(sep + 1).trim() : '';
      if (!claim || !permsRaw) {
        throw new Error(
          `SSO provider "${providerId}" has an invalid permission map entry: "${entry}"`,
        );
      }
      const permissions = permsRaw
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          if (!allowed.includes(p)) {
            throw new Error(
              `SSO provider "${providerId}" maps to unknown permission "${p}"`,
            );
          }
          return p as Permission;
        });
      return { claim, permissions };
    });
};

const titleCase = (name: string): string =>
  name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

const required = (
  env: NodeJS.ProcessEnv,
  providerId: string,
  rawName: string,
  key: string,
): string => {
  const value = env[`SSO_${rawName}_${key}`];
  if (!value || !value.trim()) {
    throw new Error(
      `SSO provider "${providerId}" is missing required env SSO_${rawName}_${key}`,
    );
  }
  return value.trim();
};

/**
 * Pure builder: parses + validates every declared provider from the given env.
 * Throws (fail-fast) on any misconfiguration. Zero providers is valid → SSO off.
 * Exported for testing with an explicit env object.
 */
export const buildRegistryFromEnv = (
  env: NodeJS.ProcessEnv,
): Map<string, SsoProviderConfig> => {
  const allowInsecure = env.SSO_ALLOW_INSECURE_ISSUERS === 'true';
  const registry = new Map<string, SsoProviderConfig>();

  for (const key of Object.keys(env)) {
    const match = key.match(ENV_PREFIX);
    if (!match) continue;
    const rawName = match[1];
    const id = rawName.toLowerCase();

    const issuer = required(env, id, rawName, 'ISSUER');
    assertSafeIssuer(id, issuer, allowInsecure);

    registry.set(id, {
      id,
      displayName: env[`SSO_${rawName}_DISPLAY_NAME`]?.trim() || titleCase(id),
      iconKey: env[`SSO_${rawName}_ICON_KEY`]?.trim() || undefined,
      issuer,
      clientId: required(env, id, rawName, 'CLIENT_ID'),
      clientSecret: required(env, id, rawName, 'CLIENT_SECRET'),
      redirectUri: required(env, id, rawName, 'REDIRECT_URI'),
      postLogoutRedirectUri:
        env[`SSO_${rawName}_POST_LOGOUT_REDIRECT_URI`]?.trim() || undefined,
      scopes: env[`SSO_${rawName}_SCOPES`]?.trim() || 'openid profile email',
      groupsClaim: env[`SSO_${rawName}_GROUPS_CLAIM`]?.trim() || 'groups',
      permissionMap: parsePermissionMap(
        id,
        env[`SSO_${rawName}_PERMISSION_MAP`],
      ),
    });
  }

  return registry;
};

let cache: Map<string, SsoProviderConfig> | null = null;

const registry = (): Map<string, SsoProviderConfig> => {
  if (!cache) cache = buildRegistryFromEnv(process.env);
  return cache;
};

/** Clears the memoised registry — for tests that mutate `process.env`. */
export const resetRegistryCache = (): void => {
  cache = null;
};

/** Validates the SSO config at boot; throws on misconfiguration (fail-fast). */
export const validateSsoConfig = (): void => {
  cache = buildRegistryFromEnv(process.env);
};

export const getAllProviderConfigs = (): SsoProviderConfig[] =>
  Array.from(registry().values());

export const getProviderConfig = (id: string): SsoProviderConfig | undefined =>
  registry().get(id);

export const isSsoEnabled = (): boolean => registry().size > 0;
