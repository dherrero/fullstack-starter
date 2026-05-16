import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: __dirname,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../../coverage/apps/gateway',
      provider: 'v8',
    },
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
