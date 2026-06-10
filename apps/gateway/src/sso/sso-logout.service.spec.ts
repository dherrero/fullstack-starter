import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearLogoutHintCookie,
  readLogoutHint,
  setLogoutHintCookie,
} from './sso-logout.service';

const hint = { provider: 'okta', idToken: 'header.payload.sig' };

const mkRes = () => {
  const captured: { token?: string; options?: Record<string, unknown> } = {};
  const res = {
    cookie: vi.fn(
      (_n: string, token: string, options: Record<string, unknown>) => {
        captured.token = token;
        captured.options = options;
      },
    ),
    clearCookie: vi.fn(),
  };
  return { res: res as never, captured };
};

describe('sso-logout.service', () => {
  const saved = process.env.SSO_STATE_SECRET;
  beforeEach(() => (process.env.SSO_STATE_SECRET = 'test-secret'));
  afterEach(() => {
    process.env.SSO_STATE_SECRET = saved;
    vi.restoreAllMocks();
  });

  it('round-trips the logout hint through an HttpOnly cookie', () => {
    const { res, captured } = mkRes();
    setLogoutHintCookie(res, hint);
    expect(captured.options).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    const req = { cookies: { sso_logout: captured.token } } as never;
    expect(readLogoutHint(req)).toEqual(hint);
  });

  it('returns null for a tampered or absent hint', () => {
    const { res, captured } = mkRes();
    setLogoutHintCookie(res, hint);
    expect(
      readLogoutHint({
        cookies: { sso_logout: `${captured.token}x` },
      } as never),
    ).toBeNull();
    expect(readLogoutHint({ cookies: {} } as never)).toBeNull();
  });

  it('clears the cookie', () => {
    const { res } = mkRes();
    clearLogoutHintCookie(res);
    expect(
      (res as unknown as { clearCookie: ReturnType<typeof vi.fn> }).clearCookie,
    ).toHaveBeenCalledWith(
      'sso_logout',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
