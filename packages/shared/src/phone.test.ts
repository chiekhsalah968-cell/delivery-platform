import { describe, expect, it } from 'vitest';
import { isDzMobile, normalizeDzPhone } from './phone';

describe('normalizeDzPhone', () => {
  it('normalizes all common Algerian formats to the same E.164', () => {
    const expected = '+213550123456';
    for (const input of [
      '0550123456',
      '05 50 12 34 56',
      '05-50-12-34-56',
      '+213550123456',
      '00213550123456',
      '213550123456',
    ]) {
      expect(normalizeDzPhone(input)).toBe(expected);
    }
  });

  it('accepts Mobilis (6) and Ooredoo (7) prefixes', () => {
    expect(normalizeDzPhone('0661234567')).toBe('+213661234567');
    expect(normalizeDzPhone('0771234567')).toBe('+213771234567');
  });

  it('rejects invalid input', () => {
    for (const input of ['', '   ', '12345', 'abcdefghij', '05501234567890']) {
      expect(normalizeDzPhone(input)).toBeNull();
    }
  });

  it('rejects non-Algerian numbers', () => {
    expect(normalizeDzPhone('+33612345678')).toBeNull();
    expect(normalizeDzPhone('+212612345678')).toBeNull();
  });
});

describe('isDzMobile', () => {
  it('identifies mobile prefixes 5/6/7', () => {
    expect(isDzMobile('0550123456')).toBe(true);
    expect(isDzMobile('0661234567')).toBe(true);
    expect(isDzMobile('0771234567')).toBe(true);
  });

  it('rejects landlines (e.g. Algiers 021)', () => {
    expect(isDzMobile('021234567')).toBe(false);
  });
});