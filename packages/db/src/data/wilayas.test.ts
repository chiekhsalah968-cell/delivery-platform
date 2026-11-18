import { describe, expect, it } from 'vitest';
import { WILAYAS } from './wilayas';

describe('wilayas reference data', () => {
  it('contains exactly the 58 official wilayas', () => {
    expect(WILAYAS).toHaveLength(58);
    expect(WILAYAS.map((w) => w.code)).toEqual(Array.from({ length: 58 }, (_, i) => i + 1));
  });

  it('has unique codes and non-empty bilingual names', () => {
    const codes = new Set(WILAYAS.map((w) => w.code));
    expect(codes.size).toBe(58);
    for (const w of WILAYAS) {
      expect(w.nameAr.trim().length).toBeGreaterThan(0);
      expect(w.nameFr.trim().length).toBeGreaterThan(0);
    }
  });

  it('includes the 2019 southern wilayas', () => {
    const codes = WILAYAS.map((w) => w.code);
    for (const code of [49, 50, 51, 52, 53, 54, 55, 56, 57, 58]) {
      expect(codes).toContain(code);
    }
  });
});