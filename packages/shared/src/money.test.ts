import { describe, expect, it } from 'vitest';
import { assertValidDzdAmount, formatDzd, roundToCashStep } from './money';

describe('assertValidDzdAmount', () => {
  it('accepts non-negative safe integers', () => {
    expect(() => assertValidDzdAmount(0)).not.toThrow();
    expect(() => assertValidDzdAmount(1250)).not.toThrow();
  });

  it('rejects negatives, fractions and unsafe values', () => {
    for (const bad of [-1, 10.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => assertValidDzdAmount(bad)).toThrow(RangeError);
    }
  });
});

describe('roundToCashStep', () => {
  it('rounds to the nearest 5 DZD by default', () => {
    expect(roundToCashStep(123)).toBe(125);
    expect(roundToCashStep(122)).toBe(120);
    expect(roundToCashStep(125)).toBe(125);
    expect(roundToCashStep(0)).toBe(0);
  });

  it('supports a custom step', () => {
    expect(roundToCashStep(123, 10)).toBe(120);
    expect(roundToCashStep(127, 10)).toBe(130);
  });

  it('rejects invalid steps', () => {
    expect(() => roundToCashStep(100, 0)).toThrow(RangeError);
    expect(() => roundToCashStep(100, -5)).toThrow(RangeError);
  });
});

describe('formatDzd', () => {
  it('formats in both locales without fractions', () => {
    const fr = formatDzd(1250, 'fr');
    const ar = formatDzd(1250, 'ar');
    expect(fr).toContain('1');
    expect(fr).toContain('250');
    expect(ar).toContain('1');
    expect(ar).toContain('250');
    expect(fr).not.toContain(',00');
    expect(fr).not.toBe(ar);
  });
});