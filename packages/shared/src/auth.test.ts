import { describe, expect, it } from 'vitest';
import { loginSchema, passwordSchema, refreshSchema, registerSchema } from './auth';

describe('passwordSchema', () => {
  it('accepts a strong password', () => {
    expect(passwordSchema.safeParse('Passw0rd!').success).toBe(true);
  });

  it('rejects short, long, or letter/digit-less passwords', () => {
    for (const value of ['Ab1', 'a'.repeat(129), 'abcdefgh', '12345678', '        ']) {
      expect(passwordSchema.safeParse(value).success).toBe(false);
    }
  });
});

describe('registerSchema', () => {
  const base = { phone: '0550123456', password: 'Passw0rd!', role: 'customer' };

  it('accepts a valid customer registration', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('accepts merchant and courier roles', () => {
    expect(registerSchema.safeParse({ ...base, role: 'merchant' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, role: 'courier' }).success).toBe(true);
  });

  it('rejects admin self-registration', () => {
    expect(registerSchema.safeParse({ ...base, role: 'admin' }).success).toBe(false);
  });

  it('rejects non-Algerian phones and bad emails', () => {
    expect(registerSchema.safeParse({ ...base, phone: '+33612345678' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });

  it('accepts an optional valid email and locale', () => {
    expect(
      registerSchema.safeParse({ ...base, email: 'user@example.dz', locale: 'fr' }).success,
    ).toBe(true);
  });
});

describe('loginSchema', () => {
  it('requires identifier and password', () => {
    expect(loginSchema.safeParse({ identifier: '0550123456', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ identifier: 'a', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ identifier: '0550123456', password: '' }).success).toBe(false);
  });
});

describe('refreshSchema', () => {
  it('requires a non-trivial token', () => {
    expect(refreshSchema.safeParse({ refreshToken: 'abc' }).success).toBe(false);
    expect(refreshSchema.safeParse({ refreshToken: 'a'.repeat(40) }).success).toBe(true);
  });
});