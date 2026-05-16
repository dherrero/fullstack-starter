import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@dto';
import { INTERNAL_AUTH_HEADER, verifyInternalAuth } from '@internal-auth';
import { ApiClient } from './api.client';

describe('ApiClient.validateCredentials', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.API_BASE_URL = 'http://api.test:3200';
    process.env.INTERNAL_JWT_SECRET = 'client-test-secret';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('signs a system context, calls /internal/auth/validate and returns the user', async () => {
    const expected = {
      id: 1,
      email: 'a@b.com',
      permissions: [Permission.ADMIN],
    };

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      const token = headers[INTERNAL_AUTH_HEADER];
      const claims = verifyInternalAuth(token, {
        secret: 'client-test-secret',
      });
      expect(claims.scope).toBe('auth.validate');
      return new Response(JSON.stringify(expected), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const result = await ApiClient.validateCredentials(
      'a@b.com',
      'pwd',
      'req-1',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'http://api.test:3200/internal/auth/validate',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result).toEqual(expected);
  });

  it('throws on non-2xx with the api error message', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ error: 'bad creds' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })) as typeof fetch;

    await expect(
      ApiClient.validateCredentials('a@b.com', 'pwd', 'req-2'),
    ).rejects.toThrow('bad creds');
  });
});
