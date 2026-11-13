import { describe, expect, it } from 'vitest';
import { barWidth, greeting } from '../src/lib/analytics';

describe('analytics presentation', () => {
  it('greets people using the local hour, including time boundaries', () => {
    expect(greeting(0)).toBe('Boa noite');
    expect(greeting(4)).toBe('Boa noite');
    expect(greeting(5)).toBe('Bom dia');
    expect(greeting(11)).toBe('Bom dia');
    expect(greeting(12)).toBe('Boa tarde');
    expect(greeting(17)).toBe('Boa tarde');
    expect(greeting(18)).toBe('Boa noite');
    expect(greeting(23)).toBe('Boa noite');
  });
  it('scales comparable counts and keeps empty or repeated-event bars within bounds', () => {
    expect(barWidth(25, 100)).toBe(25);
    expect(barWidth(0, 0)).toBe(0);
    expect(barWidth(2, 1)).toBe(100);
    expect(barWidth(-1, 100)).toBe(0);
  });
});
