import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  webServer: {
    command:
      'pnpm build && SCENARIO_SERVER_ORIGIN=http://127.0.0.1:3100 pnpm exec next start -p 3100',
    url: 'http://127.0.0.1:3100/scenarios',
    timeout: 180_000,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
