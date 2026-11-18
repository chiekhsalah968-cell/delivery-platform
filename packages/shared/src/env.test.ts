import { describe, expect, it } from 'vitest';
import { parseApiEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://delivery:secret@localhost:5432/delivery',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  JWT_REFRESH_SECRET: 'b'.repeat(64),
};

describe('parseApiEnv', () => {
  it('applies defaults', () => {
    const env = parseApiEnv(valid);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(3002);
    expect(env.ACCESS_TOKEN_TTL_S).toBe(900);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3001']);
  });

  it('coerces numeric strings and splits CORS origins', () => {
    const env = parseApiEnv({
      ...valid,
      PORT: '4000',
      CORS_ORIGINS: 'http://localhost:3000, https://app.example.com',
    });
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://app.example.com']);
  });

  it('rejects missing or malformed required values', () => {
    expect(() => parseApiEnv({ ...valid, DATABASE_URL: 'mysql://localhost/db' })).toThrow();
    expect(() => parseApiEnv({ ...valid, REDIS_URL: 'http://localhost' })).toThrow();
    expect(() => parseApiEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow();
    const { DATABASE_URL: _omit, ...missing } = valid;
    expect(() => parseApiEnv(missing)).toThrow();
  });

  it('rejects placeholder secrets in production', () => {
    expect(() =>
      parseApiEnv({
        ...valid,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'change_me'.padEnd(40, 'x'),
      }),
    ).toThrow(/placeholder/);
  });

  it('accepts strong secrets in production', () => {
    const env = parseApiEnv({ ...valid, NODE_ENV: 'production' });
    expect(env.NODE_ENV).toBe('production');
  });
});