import { describe, expect, it } from 'vitest';
import { cn, formatNumber, formatPct } from '../src/lib/utils';

describe('cn', () => {
    it('merges class names and resolves Tailwind conflicts', () => {
        expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
        expect(cn('text-lg', 'text-sm')).toBe('text-sm');
        expect(cn('p-4', 'p-2')).toBe('p-2');
        expect(cn('bg-red-500', 'bg-blue-500', 'bg-green-500')).toBe('bg-green-500');
        expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');    
    })
});

describe('formatNumber', () => {
    it('formats numbers with commas', () => {
        expect(formatNumber(1000)).toBe('1,000');
        expect(formatNumber(1234567)).toBe('1,234,567');
        expect(formatNumber(9876543210)).toBe('9,876,543,210');
        expect(formatNumber(42)).toBe('42');
    });
});

describe('formatPct', () => {
    it('formats a ratio as one-decimal percentage', () => {
        expect(formatPct(0.1234)).toBe('12.3%');
        expect(formatPct(0.0)).toBe('0.0%');
        expect(formatPct(1.0)).toBe('100.0%');
    });
});