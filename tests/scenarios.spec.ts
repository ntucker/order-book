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

  await page.goto(`/scenarios/streamed-reveal/${runId}/BTCUSDT`, {
    waitUntil: 'commit',
  });
  await expect(page.getByText('Time stopped')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();

  await page.getByRole('button', { name: 'Advance 1 milestone' }).click();
  await expect(page.getByText('1 / 6')).toBeVisible();
  await expect(page.getByLabel('BTCUSDT ticker')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Markets and ticker reveal/ }),
  ).toHaveAttribute('aria-pressed', 'true');

  for (const step of [2, 3, 4, 5, 6]) {
    await page.getByRole('button', { name: 'Advance 1 milestone' }).click();
    await expect(page.getByText(`${step} / 6`)).toBeVisible();
  }
  await expect(page.getByText('Complete', { exact: true })).toBeVisible();
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.05');
  await page
    .getByRole('button', { name: /One ticker update, three locations/ })
    .click();
  await expect(
    page.getByRole('heading', { name: /Normalized store diff/i }),
  ).toBeVisible();

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

test('older scripted book data cannot regress the normalized entity', async ({
  page,
}) => {
  const runId = crypto.randomUUID();
  await page.goto(`/scenarios/late-server-merge/${runId}/BTCUSDT`, {
    waitUntil: 'commit',
  });
  const advance = page.getByRole('button', {
    name: 'Advance 1 milestone',
  });
  for (const step of [1, 2, 3, 4]) {
    await advance.click();
    await expect(page.getByText(`${step} / 4`)).toBeVisible();
  }
  await page
    .getByRole('button', { name: /Older update arrives and is rejected/ })
    .click();
  await expect(page.getByText('No normalized values changed.')).toBeVisible();
});

test('auto-play survives symbol navigation and finishes on ETH', async ({
  page,
}) => {
  const runId = crypto.randomUUID();
  await page.goto(`/scenarios/symbol-transition/${runId}/BTCUSDT`, {
    waitUntil: 'commit',
  });
  await page.getByText('Auto', { exact: true }).click();
  await page.getByLabel('Milestone interval').selectOption('1000');
  await page
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `/scenarios/symbol-transition/${runId}/ETHUSDT(?:\\?.*)?$`,
    ),
    { timeout: 15_000 },
  );
  await expect(page.getByText('4 / 4')).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole('link', { name: /BTC.*100\.08/ }).first(),
  ).toBeVisible();
});
