import { defineConfig, devices } from '@playwright/test';

const chromium = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'NEXT_DIST_DIR=.next-e2e pnpm build && NEXT_DIST_DIR=.next-e2e pnpm exec next start -p 3100',
      url: 'http://127.0.0.1:3100/scenarios',
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command:
        'NEXT_DIST_DIR=.next-console pnpm exec next dev --hostname 127.0.0.1 --port 3200 --webpack',
      url: 'http://127.0.0.1:3200/scenarios',
      timeout: 180_000,
      reuseExistingServer: false,
    },
  ],
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/browser-console.spec.ts',
      use: { ...chromium, baseURL: 'http://127.0.0.1:3100' },
    },
    {
      name: 'dev-console',
      testMatch: '**/browser-console.spec.ts',
      use: { ...chromium, baseURL: 'http://127.0.0.1:3200' },
    },
  ],
});
