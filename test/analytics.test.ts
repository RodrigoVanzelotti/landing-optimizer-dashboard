import { describe, expect, it } from 'vitest';
import { barWidth, chartPath, changeLabel, greeting } from '../src/lib/analytics';

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
  it('does not connect missing history to real zero values in temporal charts', () => {
    expect(chartPath([2, null, 0, 4], 4)).toBe('M48,116  M480,208 L696,24');
    expect(chartPath([null, null], 4).trim()).toBe('');
    expect(chartPath([0], 4)).toBe('M48,208');
  });
  it('handles zero comparison bases and distinguishes percentage points from growth', () => {
    expect(changeLabel(20, 10)).toBe('+100%');
    expect(changeLabel(0, 10)).toBe('-100%');
    expect(changeLabel(10, 0)).toBe('Sem base anterior');
    expect(changeLabel(0, 0)).toBe('Sem variação');
    expect(changeLabel(.6, .4, true)).toBe('+20 p.p.');
    expect(changeLabel(null, .4, true)).toBe('Sem base para comparar');
  });
});
