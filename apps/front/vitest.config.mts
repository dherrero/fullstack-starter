/// <reference types="vitest" />
import { defineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { join } from 'path';

export default defineConfig({
  plugins: [
    angular({
      tsconfig: join(__dirname, 'tsconfig.spec.json'),
    }),
  ],
  test: {
    globals: true,
    root: __dirname,
    environment: 'happy-dom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      reportsDirectory: '../../coverage/apps/front',
      provider: 'v8',
    },
  },
  resolve: {
    alias: {
      '@dto': join(__dirname, '../../libs/rest-dto/src/index.ts'),
      '@front': join(__dirname, 'src'),
      '@back': join(__dirname, '../back/src'),
    },
  },
});
