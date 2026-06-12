import { SsoProviderPublicDTO } from '@dto';
import { SsoProviderConfig, getAllProviderConfigs } from './provider-registry';
import { SamlProviderConfig } from './saml-types';
import {
  getAllSamlProviderConfigs,
  isSamlEnabled,
  resetSamlRegistryCache,
} from './saml-provider-registry';
import { isSsoEnabled, resetRegistryCache } from './provider-registry';

// Re-export so callers that previously depended on resetRegistryCache from
// provider-registry can also reset the federated cache atomically.
export { resetRegistryCache, resetSamlRegistryCache };

/**
 * Resets both underlying protocol caches in one call.
 * Use in tests that mutate `process.env` or need a clean slate.
 */
export const resetFederatedRegistryCache = (): void => {
  resetRegistryCache();
  resetSamlRegistryCache();
};

// ---------------------------------------------------------------------------
// Discriminated-union type for protocol-aware provider lookup
// ---------------------------------------------------------------------------

/** Result of {@link getFederatedProvider}: protocol-tagged config. */
export type FederatedProvider =
  | { protocol: 'oidc'; config: SsoProviderConfig }
  | { protocol: 'saml'; config: SamlProviderConfig };

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the unified public metadata for all configured SSO providers
 * (both OIDC and SAML), sorted by provider id for a stable display order.
 *
 * This is the single source of truth for the `/auth/sso/providers` endpoint.
 * It MUST NOT include any secret-bearing fields (clientSecret, cert PEMs,
 * issuer URLs, decryptionPvk, etc.) — only `id`, `displayName`, `iconKey`,
 * and `protocol`.
 */
export const listPublicProviders = (): SsoProviderPublicDTO[] => {
  const oidcProviders: SsoProviderPublicDTO[] = getAllProviderConfigs().map(
    ({ id, displayName, iconKey }) => ({
      id,
      displayName,
      iconKey,
      protocol: 'oidc' as const,
    }),
  );

  const samlProviders: SsoProviderPublicDTO[] = getAllSamlProviderConfigs().map(
    ({ id, displayName, iconKey }) => ({
      id,
      displayName,
      iconKey,
      protocol: 'saml' as const,
    }),
  );

  return [...oidcProviders, ...samlProviders].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
};

/**
 * Looks up a provider by id across both OIDC and SAML registries.
 * Returns a discriminated union so callers can narrow to the correct
 * config type without unsafe casts.
 *
 * Returns `undefined` when no provider with that id is registered.
 */
export const getFederatedProvider = (
  id: string,
): FederatedProvider | undefined => {
  const oidcConfigs = getAllProviderConfigs();
  const oidc = oidcConfigs.find((c) => c.id === id);
  if (oidc) return { protocol: 'oidc', config: oidc };

  const samlConfigs = getAllSamlProviderConfigs();
  const saml = samlConfigs.find((c) => c.id === id);
  if (saml) return { protocol: 'saml', config: saml };

  return undefined;
};

/**
 * Returns `true` when at least one SSO provider (OIDC or SAML) is configured.
 * Use this to conditionally show the SSO section in the UI or enable
 * federated-login routes.
 */
export const isFederationEnabled = (): boolean =>
  isSsoEnabled() || isSamlEnabled();
