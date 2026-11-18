import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Normalize an Algerian phone number to E.164 (+213...).
 * Accepts local formats: 0550123456, 05 50 12 34 56, +213550123456, 00213...
 * Returns null for invalid or non-Algerian numbers.
 */
export function normalizeDzPhone(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed, 'DZ');
  if (!parsed || !parsed.isValid() || parsed.country !== 'DZ') return null;
  return parsed.number;
}

export function isDzMobile(input: string): boolean {
  const parsed = parsePhoneNumberFromString(input.trim(), 'DZ');
  if (!parsed || !parsed.isValid() || parsed.country !== 'DZ') return false;
  const national = parsed.nationalNumber.toString();
  return /^[567]/.test(national);
}