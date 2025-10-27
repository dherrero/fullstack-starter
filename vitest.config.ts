import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/apps/front/**', // Frontend has its own config
    ],
  },
  resolve: {
    alias: {
      '@dto': resolve(__dirname, 'libs/rest-dto/src/index.ts'),
      '@front': resolve(__dirname, 'apps/front/src'),
      '@back': resolve(__dirname, 'apps/back/src'),
    },
  },
});
