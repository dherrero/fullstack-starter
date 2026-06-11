import { BaseClient, custom, Issuer } from 'openid-client';
import { getProviderConfig } from './provider-registry';

// Bound every IdP network call (discovery, token exchange, JWKS) so a slow or
// hostile issuer cannot hang the gateway.
custom.setHttpOptionsDefaults({ timeout: 5000 });

export type DiscoverIssuer = (issuer: string) => Promise<Issuer<BaseClient>>;

// One discovered+configured client per provider; discovery (and the JWKS it
// caches internally) runs once. openid-client validates the ID token signature
// against that JWKS on `client.callback()`, so we never hand-roll key handling.
const clientCache = new Map<string, BaseClient>();

export const getClient = async (
  providerId: string,
  discover: DiscoverIssuer = (issuer) => Issuer.discover(issuer),
): Promise<BaseClient> => {
  const cached = clientCache.get(providerId);
  if (cached) return cached;

  const config = getProviderConfig(providerId);
  if (!config) throw new Error(`Unknown SSO provider: ${providerId}`);

  const issuer = await discover(config.issuer);
  const client = new issuer.Client({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uris: [config.redirectUri],
    response_types: ['code'],
  });
  clientCache.set(providerId, client);
  return client;
};

/** Clears the discovered-client cache — for tests. */
export const resetDiscoveryCache = (): void => clientCache.clear();
