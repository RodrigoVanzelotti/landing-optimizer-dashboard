import { describe, expect, it } from 'vitest';
import { normalizeSiteDomain } from '../src/lib/site-domain';

describe('site domain normalization', () => {
  it.each([
    ['example.com', 'example.com'],
    ['  EXAMPLE.com/  ', 'example.com'],
    ['https://example.com/', 'example.com'],
    ['HTTP://EXAMPLE.COM/', 'example.com'],
    ['//example.com/', 'example.com'],
    ['https://www.example.com/landing?campaign=1#form', 'www.example.com'],
    ['example.com/landing?campaign=1#form', 'example.com'],
    ['https://shop.example.com:8443/', 'shop.example.com:8443'],
    ['localhost:3000/', 'localhost:3000'],
    ['https://açai.com.br/', 'xn--aai-2la.com.br'],
    ['example.com./', 'example.com'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeSiteDomain(input)).toBe(expected);
  });

  it.each([
    '', '  ', 'not a domain', 'https://', 'ftp://example.com',
    'https://user:password@example.com', 'user@example.com',
    'https://example.com:99999', 'example..com', '-example.com',
    'example_.com', 'example.com\\other', `${'a'.repeat(64)}.com`,
  ])('rejects invalid or unsupported input: %s', input => {
    expect(() => normalizeSiteDomain(input)).toThrow('Informe um domínio ou uma URL válida');
  });
});
