import { ClaimPermissionMapping, Permission, SsoProviderPublicDTO } from '@dto';

/**
 * Full, secret-bearing configuration of one OIDC provider. Lives ONLY in the
 * gateway — never serialised to the client. Use {@link listPublicProviders}
 * for anything the browser may see.
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
  scopes: string;
  groupsClaim: string;
  permissionMap: ClaimPermissionMapping[];
}

const ENV_PREFIX = /^SSO_(.+)_ISSUER$/;

// Hosts that must never be reachable as an issuer: loopback, link-local
// (incl. the 169.254.169.254 cloud metadata endpoint), and RFC1918 ranges.
// SSRF defense — an attacker-influenced issuer must not pivot to internal hosts.
const isBlockedHost = (host: string): boolean => {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0' || h === '::1') return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return false;
  const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
  if (a === 127 || a === 10 || a === 0) return true; // loopback / private / this-host
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 192 && b === 168) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  return false;
};

const assertSafeIssuer = (
  providerId: string,
  issuer: string,
  allowInsecure: boolean,
): void => {
  let url: URL;
  try {
    url = new URL(issuer);
  } catch {
    throw new Error(`SSO provider "${providerId}" has a malformed issuer URL`);
  }
  if (url.protocol !== 'https:') {
    if (allowInsecure && url.protocol === 'http:') return;
    throw new Error(
      `SSO provider "${providerId}" issuer must use https (got ${url.protocol})`,
    );
  }
  if (!allowInsecure && isBlockedHost(url.hostname)) {
    throw new Error(
      `SSO provider "${providerId}" issuer host is not allowed (loopback/link-local/private)`,
    );
  }
};

const parsePermissionMap = (
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

/** Secret-free provider metadata for the browser (login buttons). */
export const listPublicProviders = (): SsoProviderPublicDTO[] =>
  getAllProviderConfigs().map(({ id, displayName, iconKey }) => ({
    id,
    displayName,
    iconKey,
  }));
