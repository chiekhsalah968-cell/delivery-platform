import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// NestJS DI requires decorator metadata, which esbuild does not emit — SWC does.
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
    include: ['src/**/*.spec.ts'],
    // Integration tests hit a live DB/Redis and run via vitest.integration.config.ts.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*.integration.spec.ts'],
  },
});