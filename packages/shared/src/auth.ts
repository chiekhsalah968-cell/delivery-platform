import { z } from 'zod';
import { LOCALES, ROLES } from './constants';
import { normalizeDzPhone } from './phone';

/** Roles a visitor may self-register as. Admin accounts are provisioned internally. */
export const PUBLIC_REGISTRATION_ROLES = ['customer', 'merchant', 'courier'] as const;
export type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];

export const USER_STATUSES = ['active', 'pending', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const dzPhoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((value) => normalizeDzPhone(value) !== null, {
    message: 'Invalid Algerian phone number',
  });

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: 'Password must contain at least one letter and one digit',
  });

export const registerSchema = z.object({
  phone: dzPhoneSchema,
  password: passwordSchema,
  role: z.enum(PUBLIC_REGISTRATION_ROLES),
  email: z.email('Invalid email address').optional(),
  locale: z.enum(LOCALES).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

/** Public user shape returned by the API. Never includes passwordHash. */
export const authUserSchema = z.object({
  id: z.uuid(),
  phone: z.string(),
  email: z.string().nullable(),
  role: z.enum(ROLES),
  status: z.enum(USER_STATUSES),
  locale: z.enum(LOCALES),
  createdAt: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;