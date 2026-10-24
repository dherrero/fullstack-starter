import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  clearSamlTransactionCookie,
  readSamlTransaction,
  setSamlTransactionCookie,
} from './saml-transaction.service';

const SECRET = 'test-secret';

const mkRes = () => {
  const res = {} as Record<string, ReturnType<typeof vi.fn>>;
  res.cookie = vi.fn();
  res.clearCookie = vi.fn();
  return res as never;
};

const tx = {
  provider: 'acme',
  requestId: '_feedfacefeedfacefeedfacefeedface',
  returnTo: '/dashboard',
};

describe('saml-transaction.service', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.SSO_STATE_SECRET = SECRET;
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.clearAllMocks();
  });

  it('set → read roundtrip preserves the transaction', () => {
    const res = mkRes() as never as { cookie: ReturnType<typeof vi.fn> };
    setSamlTransactionCookie(res as never, tx);
    expect(res.cookie).toHaveBeenCalledOnce();
    const [name, token, options] = res.cookie.mock.calls[0];
    expect(name).toBe('saml_tx');
    expect(options).toMatchObject({ httpOnly: true, maxAge: 5 * 60 * 1000 });

    const req = { cookies: { saml_tx: token } } as never;
    expect(readSamlTransaction(req)).toEqual(tx);
  });

  it('uses SameSite=None+Secure in production (cross-site ACS POST)', () => {
    process.env.NODE_ENV = 'production';
    const res = mkRes() as never as { cookie: ReturnType<typeof vi.fn> };
    setSamlTransactionCookie(res as never, tx);
    expect(res.cookie.mock.calls[0][2]).toMatchObject({
      sameSite: 'none',
      secure: true,
      httpOnly: true,
    });
  });

  it('throws when no signing secret is configured', () => {
    delete process.env.SSO_STATE_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    expect(() => setSamlTransactionCookie(mkRes(), tx)).toThrow(
      /secret is not configured/,
    );
  });

  it('rejects a tampered token', () => {
    const res = mkRes() as never as { cookie: ReturnType<typeof vi.fn> };
    setSamlTransactionCookie(res as never, tx);
    const token = res.cookie.mock.calls[0][1] as string;
    const tampered = token.slice(0, -2) + 'xx';
    expect(
      readSamlTransaction({ cookies: { saml_tx: tampered } } as never),
    ).toBeNull();
  });

  it('rejects a token signed with the wrong typ (no cross-cookie reuse)', () => {
    // A valid OIDC transaction cookie must never be accepted as a SAML one.
    const foreign = jwt.sign({ ...tx, typ: 'sso_tx' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: 300,
    });
    expect(
      readSamlTransaction({ cookies: { saml_tx: foreign } } as never),
    ).toBeNull();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ ...tx, typ: 'saml_tx' }, SECRET, {
      algorithm: 'HS256',
      expiresIn: -10,
    });
    expect(
      readSamlTransaction({ cookies: { saml_tx: expired } } as never),
    ).toBeNull();
  });

  it('returns null when the cookie is absent', () => {
    expect(readSamlTransaction({ cookies: {} } as never)).toBeNull();
  });

  it('clear removes the cookie', () => {
    const res = mkRes() as never as { clearCookie: ReturnType<typeof vi.fn> };
    clearSamlTransactionCookie(res as never);
    expect(res.clearCookie).toHaveBeenCalledWith(
      'saml_tx',
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
