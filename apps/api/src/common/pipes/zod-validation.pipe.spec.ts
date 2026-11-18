import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { registerSchema } from '@delivery/shared';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(registerSchema);

  it('returns parsed data for a valid payload', () => {
    const result = pipe.transform({
      phone: '0550123456',
      password: 'Passw0rd!',
      role: 'customer',
    });
    expect(result).toMatchObject({ phone: '0550123456', role: 'customer' });
  });

  it('throws BadRequestException with field errors for an invalid payload', () => {
    try {
      pipe.transform({ phone: 'bad', password: '123', role: 'admin' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
        errors: { path: string; message: string }[];
      };
      expect(response.message).toBe('Validation failed');
      expect(response.errors.length).toBeGreaterThan(0);
      expect(response.errors.some((e) => e.path === 'role')).toBe(true);
    }
  });
});