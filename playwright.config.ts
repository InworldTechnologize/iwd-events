import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: { trace: 'off' },
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : { command: `npx next start -p ${PORT}`, url: `http://localhost:${PORT}/api/health`, reuseExistingServer: true, timeout: 120_000 },
});
