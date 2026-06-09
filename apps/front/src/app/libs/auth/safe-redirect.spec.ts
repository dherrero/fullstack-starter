import { describe, expect, it } from 'vitest';
import { sanitizeRedirect } from './safe-redirect';

describe('sanitizeRedirect', () => {
  it('accepts same-origin relative paths', () => {
    expect(sanitizeRedirect('/profile')).toBe('/profile');
    expect(sanitizeRedirect('/users/1?tab=x#frag')).toBe('/users/1?tab=x#frag');
    expect(sanitizeRedirect('/')).toBe('/');
  });

  it('rejects open-redirect payloads', () => {
    for (const bad of [
      'https://evil.com',
      'http://evil.com',
      '//evil.com',
      '/\\evil.com',
      '/\\/evil.com',
      'javascript:alert(1)',
      'evil.com',
      '\\\\evil.com',
    ]) {
      expect(sanitizeRedirect(bad)).toBe('');
    }
  });

  it('treats empty/nullish as no redirect', () => {
    expect(sanitizeRedirect('')).toBe('');
    expect(sanitizeRedirect(null)).toBe('');
    expect(sanitizeRedirect(undefined)).toBe('');
  });
});
