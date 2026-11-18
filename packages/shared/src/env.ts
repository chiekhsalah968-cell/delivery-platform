import { z } from 'zod';

export const apiEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3002),
    DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL URL'),
    REDIS_URL: z.string().regex(/^rediss?:\/\//, 'REDIS_URL must be a Redis URL'),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_S: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_S: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3001')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
        if (env[key].includes('change_me')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: `${key} must not use a placeholder value in production`,
          });
        }
      }
    }
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(source: Record<string, unknown>): ApiEnv {
  return apiEnvSchema.parse(source);
}