import { z } from 'zod';

/**
 * Admin-only schemas. Admin accounts are provisioned server-side and authenticate
 * through a dedicated flow (password + optional TOTP 2FA), never public registration.
 */

/** Step 1 of admin login: identifier (phone or email) + password. */
export const adminLoginSchema = z.object({
  identifier: z.string().min(3, 'Phone or email is required'),
  password: z.string().min(1, 'Password is required'),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

/** Step 2 of admin login when 2FA is enabled: the short-lived challenge token + TOTP code. */
export const adminMfaVerifySchema = z.object({
  mfaToken: z.string().min(10, 'Missing 2FA challenge token'),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
});
export type AdminMfaVerifyInput = z.infer<typeof adminMfaVerifySchema>;

/** A 6-digit TOTP code, used to enable or disable 2FA. */
export const totpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
});
export type TotpCodeInput = z.infer<typeof totpCodeSchema>;

/** Platform settings are stored as a JSON object under a stable key. */
export const settingKeySchema = z
  .string()
  .regex(/^[a-z0-9_.]{1,100}$/, 'Invalid setting key');

export const adminSettingUpsertSchema = z.object({
  value: z.record(z.string(), z.unknown()),
});
export type AdminSettingUpsertInput = z.infer<typeof adminSettingUpsertSchema>;

/** Audit trail query (admin activity monitoring). */
export const auditQuerySchema = z.object({
  entity: z.string().trim().max(100).optional(),
  action: z.string().trim().max(100).optional(),
  actorId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;

/**
 * Pricing/commission configuration shape. Stored now under the `platform.pricing`
 * setting key; enforced by the Orders domain (M3) when it lands. Values are DZD.
 */
export const platformPricingSchema = z.object({
  commissionRate: z.number().min(0).max(1).default(0.1),
  baseDeliveryFee: z.number().int().min(0).default(200),
  perKmFee: z.number().int().min(0).default(50),
  minimumFee: z.number().int().min(0).default(200),
  currency: z.literal('DZD').default('DZD'),
});
export type PlatformPricing = z.infer<typeof platformPricingSchema>;