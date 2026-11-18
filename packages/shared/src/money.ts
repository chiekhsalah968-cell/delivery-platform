import type { Locale } from './constants';

/**
 * Money is handled as integer Algerian dinars (DZD has no practical subunit).
 * The database stores numeric(12,2) for gateway compatibility, but business
 * logic always rounds to whole dinars.
 */
export function assertValidDzdAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Invalid DZD amount: ${amount}`);
  }
}

/** Round to the nearest cash step (Algerian cash practice: 5 DZD). */
export function roundToCashStep(amount: number, step = 5): number {
  assertValidDzdAmount(amount);
  if (!Number.isSafeInteger(step) || step <= 0) {
    throw new RangeError(`Invalid cash step: ${step}`);
  }
  return Math.round(amount / step) * step;
}

export function formatDzd(amount: number, locale: Locale): string {
  assertValidDzdAmount(amount);
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-DZ' : 'fr-DZ', {
    style: 'currency',
    currency: 'DZD',
    maximumFractionDigits: 0,
  }).format(amount);
}