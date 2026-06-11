import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTransactionCookie,
  readTransaction,
  safeReturnTo,
  setTransactionCookie,
  SsoTransaction,
} from './sso-transaction.service';

const tx: SsoTransaction = {
  provider: 'okta',
  state: 'STATE',
  nonce: 'NONCE',
  codeVerifier: 'VERIFIER',
  returnTo: '/dashboard',
};

const mkRes = () => {
  const captured: { token?: string; options?: Record<string, unknown> } = {};
  const res = {
    cookie: vi.fn(
      (_name: string, token: string, options: Record<string, unknown>) => {
        captured.token = token;
        captured.options = options;
      },
    ),
    clearCookie: vi.fn(),
  };
  return { res: res as never, captured };
};

describe('sso-transaction.service', () => {
  const saved = process.env.SSO_STATE_SECRET;
  beforeEach(() => (process.env.SSO_STATE_SECRET = 'test-secret'));
  afterEach(() => {
    process.env.SSO_STATE_SECRET = saved;
    vi.restoreAllMocks();
  });

  it('round-trips a signed transaction through an HttpOnly, Lax cookie', () => {
    const { res, captured } = mkRes();
    setTransactionCookie(res, tx);

    expect(captured.options).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    expect(captured.token).toBeTruthy();

    const req = { cookies: { sso_tx: captured.token } } as never;
    expect(readTransaction(req)).toEqual(tx);
  });

  it('returns null for a tampered token', () => {
    const { res, captured } = mkRes();
    setTransactionCookie(res, tx);
    const tampered = `${captured.token}tamper`;
    const req = { cookies: { sso_tx: tampered } } as never;
    expect(readTransaction(req)).toBeNull();
  });

  it('returns null for a token signed with a different secret', () => {
    const { res, captured } = mkRes();
    setTransactionCookie(res, tx);
    process.env.SSO_STATE_SECRET = 'other-secret';
    const req = { cookies: { sso_tx: captured.token } } as never;
    expect(readTransaction(req)).toBeNull();
  });

  it('returns null when no cookie is present', () => {
    expect(readTransaction({ cookies: {} } as never)).toBeNull();
  });

  it('clears the cookie with matching attributes', () => {
    const { res } = mkRes();
    clearTransactionCookie(res);
    expect(
      (res as unknown as { clearCookie: ReturnType<typeof vi.fn> }).clearCookie,
    ).toHaveBeenCalledWith(
      'sso_tx',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  describe('safeReturnTo (open-redirect defense)', () => {
    it('accepts a same-site absolute path', () => {
      expect(safeReturnTo('/dashboard')).toBe('/dashboard');
      expect(safeReturnTo('/a/b?c=1')).toBe('/a/b?c=1');
    });

    it('rejects absolute, protocol-relative, backslash and scheme URLs', () => {
      expect(safeReturnTo('https://evil.com')).toBe('/');
      expect(safeReturnTo('//evil.com')).toBe('/');
      expect(safeReturnTo('/\\evil.com')).toBe('/');
      expect(safeReturnTo('javascript:alert(1)')).toBe('/');
    });

    it('rejects non-strings and control characters', () => {
      expect(safeReturnTo(undefined)).toBe('/');
      expect(safeReturnTo(42)).toBe('/');
      expect(safeReturnTo('/a\nb')).toBe('/');
    });
  });
});
