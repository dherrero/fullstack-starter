import { describe, it, expect } from 'vitest';

describe('Backend Tests', () => {
  it('should run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with strings', () => {
    const result = 'Hello Vitest';
    expect(result).toContain('Vitest');
  });

  it('should work with objects', () => {
    const obj = { name: 'Express', version: '5.1.0' };
    expect(obj).toHaveProperty('name', 'Express');
  });
});
