import { expect, test } from '@playwright/test';

test('static shell streams before gated dashboard data', async ({
  baseURL,
}) => {
  const abort = new AbortController();
  const runId = crypto.randomUUID();
  const response = await fetch(
    `${baseURL}/scenarios/streamed-reveal/${runId}/BTCUSDT`,
    {
      headers: { 'Accept-Encoding': 'identity' },
      signal: abort.signal,
    },
  );
  const first = await response.body?.getReader().read();
  abort.abort();
  const chunk = new TextDecoder().decode(first?.value);
  expect(chunk).toContain('Deterministic scenario');
  expect(chunk).toContain('Dashboard loading');
});

test('manual mode advances one visible milestone without Binance traffic', async ({
  page,
}) => {
  const runId = crypto.randomUUID();
  const binanceRequests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('binance.vision')) {
      binanceRequests.push(request.url());
    }
  });
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`/scenarios/streamed-reveal/${runId}/BTCUSDT`);
  await expect(page.getByText('Time stopped')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();

  await page.getByRole('button', { name: 'Advance 1 milestone' }).click();
  await expect(page.getByText('1 / 6')).toBeVisible();
  await expect(page.getByLabel('BTCUSDT ticker')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Markets and ticker reveal/ }),
  ).toHaveAttribute('aria-pressed', 'true');

  expect(binanceRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('scenario launcher creates an isolated run', async ({ page }) => {
  await page.goto('/scenarios');
  await expect(
    page.getByRole('heading', {
      name: 'Deterministic order-book scenarios',
    }),
  ).toBeVisible();
  await page
    .getByRole('article')
    .filter({ hasText: 'Streamed reveal and handoff' })
    .getByRole('button', { name: /Open scenario/ })
    .click();
  await expect(page).toHaveURL(/\/scenarios\/streamed-reveal\/.+\/BTCUSDT$/);
});
