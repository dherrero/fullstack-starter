import { defineConfig } from 'vitest/config';
import path from 'path';

// Dedicated config for end-to-end specs that spin up a real mock OIDC provider
// (port binding, real HTTP). Kept out of the unit suite for determinism; run
// with `npm run test:e2e`.
export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    environment: 'node',
    include: ['src/**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
  },
  resolve: {
    alias: {
      '@dto': path.resolve(__dirname, '../../libs/rest-dto/src/index.ts'),
      '@internal-auth': path.resolve(
        __dirname,
        '../../libs/internal-auth/src/index.ts',
      ),
      '@gateway': path.resolve(__dirname, './src'),
    },
  },
});
