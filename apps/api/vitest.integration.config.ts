import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests boot the real AppModule against live Postgres + Redis.
// They are excluded from the default unit run (see vitest.config.ts) so CI
// without infrastructure stays green. Run with: pnpm --filter @delivery/api test:integration
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    // 'test' disables the pino-pretty transport worker so vitest can exit cleanly.
    env: { NODE_ENV: 'test' },
  },
});