import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/helpers/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/isolation/**/*.test.ts'],
    globalSetup: ['tests/helpers/global-setup.ts'],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: {
      DATABASE_URL: (process.env.TEST_APP_BASE ?? 'postgres://iwd_app:iwd_app@localhost:5432') + '/iwd_test',
      ROOT_DOMAIN: 'localhost',
      REDIS_URL: '',
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
    },
  },
});
