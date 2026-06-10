import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./provider-registry', () => ({
  getProviderConfig: vi.fn(),
}));

import { getProviderConfig } from './provider-registry';
import { getClient, resetDiscoveryCache } from './discovery';

const config = {
  id: 'okta',
  displayName: 'Okta',
  issuer: 'https://example.okta.com',
  clientId: 'client-okta',
  clientSecret: 'secret-okta',
  redirectUri: 'https://app.example.com/cb',
  scopes: 'openid profile email',
  groupsClaim: 'groups',
  permissionMap: [],
};

describe('discovery.getClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDiscoveryCache();
  });
  afterEach(() => resetDiscoveryCache());

  it('discovers the issuer once and caches the resulting client', async () => {
    vi.mocked(getProviderConfig).mockReturnValue(config as never);
    const ClientCtor = vi.fn().mockImplementation(function (
      this: Record<string, unknown>,
      metadata: unknown,
    ) {
      this.metadata = metadata;
    });
    const fakeIssuer = { Client: ClientCtor } as never;
    const discover = vi.fn().mockResolvedValue(fakeIssuer);

    const first = await getClient('okta', discover);
    const second = await getClient('okta', discover);

    expect(discover).toHaveBeenCalledTimes(1);
    expect(discover).toHaveBeenCalledWith('https://example.okta.com');
    expect(ClientCtor).toHaveBeenCalledTimes(1);
    expect(ClientCtor).toHaveBeenCalledWith({
      client_id: 'client-okta',
      client_secret: 'secret-okta',
      redirect_uris: ['https://app.example.com/cb'],
      response_types: ['code'],
    });
    expect(first).toBe(second);
  });

  it('throws for an unknown provider', async () => {
    vi.mocked(getProviderConfig).mockReturnValue(undefined);
    const discover = vi.fn();

    await expect(getClient('nope', discover)).rejects.toThrow(
      /Unknown SSO provider: nope/,
    );
    expect(discover).not.toHaveBeenCalled();
  });
});
