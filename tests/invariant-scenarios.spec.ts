import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';

const SCENARIOS = [
  { id: 'readiness-from-records', steps: 3 },
  { id: 'rapid-book-updates', steps: 4 },
  { id: 'handoff-outcome-a', steps: 2 },
  { id: 'handoff-outcome-b', steps: 3 },
  { id: 'handoff-outcome-c', steps: 3 },
  { id: 'live-after-hydrate', steps: 4 },
  { id: 'hidden-pane-subscriptions', steps: 3 },
  { id: 'route-h', steps: 4 },
  { id: 'route-w-fetch-now', steps: 4 },
  { id: 'symbol-return', steps: 5 },
] as const;

type LedgerEvent = { kind: string; source: string };

async function openRun(page: Page, scenarioId: string) {
  const runId = crypto.randomUUID();
  const binanceRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('binance.vision')) {
      binanceRequests.push(request.url());
    }
  });
  await page.goto(`/scenarios/${scenarioId}/${runId}/BTCUSDT`, {
    waitUntil: 'commit',
  });
  await expect(page.getByText('Time stopped')).toBeVisible();
  return { runId, binanceRequests };
}

async function advance(page: Page, step: number, total: number) {
  const button = page.getByRole('button', { name: 'Advance 1 milestone' });
  await expect(button).toBeEnabled();
  await button.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.getByRole('progressbar')).toHaveText(`${step} / ${total}`);
}

async function ledger(page: Page, runId: string) {
  const response = await page.request.get(`/api/scenarios/${runId}`);
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<{ events: LedgerEvent[]; cursor: number }>;
}

function started(events: LedgerEvent[], source: string) {
  return events.filter(
    (event) => event.kind === 'request-started' && event.source === source,
  );
}

function released(events: LedgerEvent[], source: string) {
  return events.filter(
    (event) => event.kind === 'response-released' && event.source === source,
  );
}

test('launcher lists lock, record, and option postures', async ({ page }) => {
  await page.goto('/scenarios');
  await expect(page.getByRole('article')).toHaveCount(13);
  await expect(page.getByText('Lock', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Record', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Option', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('article').filter({ hasText: 'Readiness comes from records' }),
  ).toHaveAttribute('data-posture', 'lock');
  await expect(
    page.getByRole('article').filter({ hasText: 'Handoff outcome A' }),
  ).toHaveAttribute('data-posture', 'record');
  await expect(
    page.getByRole('article').filter({ hasText: 'Route H' }),
  ).toHaveAttribute('data-posture', 'option');
  await expect(page.locator('[data-scenario-diagram]')).toHaveCount(13);
  await expect(
    page.getByRole('article').filter({ hasText: 'Watch the shell' }),
  ).toHaveCount(0);
});

for (const scenario of SCENARIOS) {
  test(`${scenario.id} completes without Binance traffic`, async ({ page }) => {
    const { binanceRequests } = await openRun(page, scenario.id);
    for (let step = 1; step <= scenario.steps; step += 1) {
      await advance(page, step, scenario.steps);
    }
    await expect(page.getByText('Complete', { exact: true })).toBeVisible();
    expect(binanceRequests).toEqual([]);
  });
}

test('header ticker is ready from the watchlist list record', async ({
  page,
}) => {
  const { runId } = await openRun(page, 'readiness-from-records');
  await advance(page, 1, 3);
  await expect(page.getByLabel('Markets').first()).toBeVisible();
  await advance(page, 2, 3);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.00');
  const status = await ledger(page, runId);
  expect(started(status.events, 'tickers').length).toBeGreaterThan(0);
  expect(started(status.events, 'symbol-info').length).toBeGreaterThan(0);
  expect(started(status.events, 'ticker')).toHaveLength(0);
  await advance(page, 3, 3);
  const done = await ledger(page, runId);
  expect(started(done.events, 'ticker')).toHaveLength(0);
});

test('outcome A keeps the dashboard blank until the slowest panel', async ({
  page,
}) => {
  await openRun(page, 'handoff-outcome-a');
  await expect(page.getByLabel('BTCUSDT ticker')).toHaveCount(0);
  await advance(page, 1, 2);
  await expect(page.getByLabel('BTCUSDT ticker')).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'BTCUSDT order book' }),
  ).toBeVisible();
});

test('outcome C records first-wave fetches only, then the waterfall', async ({
  page,
}) => {
  const { runId } = await openRun(page, 'handoff-outcome-c');
  await expect(page.getByLabel('BTCUSDT ticker')).toHaveCount(0);
  await advance(page, 1, 3);
  await expect(page.getByLabel('BTCUSDT ticker')).toHaveCount(0);
  await advance(page, 2, 3);
  await expect
    .poll(async () => {
      const mid = await ledger(page, runId);
      return started(mid.events, 'symbol-info').length;
    })
    .toBeGreaterThan(0);
  const mid = await ledger(page, runId);
  expect(started(mid.events, 'symbol-info').length).toBeGreaterThan(0);
  expect(started(mid.events, 'tickers').length).toBeGreaterThan(0);
  expect(released(mid.events, 'symbol-info')).toHaveLength(0);
  expect(started(mid.events, 'ticker')).toHaveLength(0);
  expect(started(mid.events, 'book')).toHaveLength(0);
  expect(started(mid.events, 'candles')).toHaveLength(0);
  await advance(page, 3, 3);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.00');
});

test('live tick updates the header while the book is still a skeleton', async ({
  page,
}) => {
  await openRun(page, 'live-after-hydrate');
  await advance(page, 1, 4);
  await advance(page, 2, 4);
  await advance(page, 3, 4);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.05');
  await expect(
    page.getByRole('link', { name: /BTC.*100\.05/ }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'BTCUSDT order book' }),
  ).toHaveCount(0);
  await advance(page, 4, 4);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.05');
  await expect(
    page.getByRole('table', { name: 'BTCUSDT order book' }),
  ).toBeVisible();
});

test('rapid book updates keep the newest inside levels', async ({ page }) => {
  await openRun(page, 'rapid-book-updates');
  await advance(page, 1, 4);
  await advance(page, 2, 4);
  await advance(page, 3, 4);
  const book = page.getByRole('table', { name: 'BTCUSDT order book' });
  await expect(book.getByRole('cell', { name: '100.04', exact: true })).toBeVisible();
  await expect(book.getByRole('cell', { name: '100.06', exact: true })).toBeVisible();
  await advance(page, 4, 4);
  await expect(book.getByRole('cell', { name: '100.07', exact: true })).toBeVisible();
  await expect(book.getByRole('cell', { name: '100.08', exact: true })).toBeVisible();
  await expect(book.getByRole('cell', { name: '100.06', exact: true })).toHaveCount(0);
});

test('route H does not fetch candles until the chart piece', async ({
  page,
}) => {
  const { runId } = await openRun(page, 'route-h');
  await advance(page, 1, 4);
  await advance(page, 2, 4);
  await advance(page, 3, 4);
  const before = await ledger(page, runId);
  expect(started(before.events, 'candles')).toHaveLength(0);
  expect(released(before.events, 'candles')).toHaveLength(0);
  await advance(page, 4, 4);
  const after = await ledger(page, runId);
  expect(started(after.events, 'candles').length).toBeGreaterThan(0);
});

test('route W fetch-now starts slow requests before their snapshots', async ({
  page,
}) => {
  const { runId } = await openRun(page, 'route-w-fetch-now');
  await advance(page, 1, 4);
  await advance(page, 2, 4);
  await advance(page, 3, 4);
  const mid = await ledger(page, runId);
  expect(started(mid.events, 'book').length).toBeGreaterThan(0);
  expect(released(mid.events, 'book')).toHaveLength(0);
  await advance(page, 4, 4);
  await expect(
    page.getByRole('table', { name: 'BTCUSDT order book' }),
  ).toBeVisible();
});

test('hidden mobile pane still receives live ticker updates', async ({
  page,
}) => {
  await openRun(page, 'hidden-pane-subscriptions');
  await advance(page, 1, 3);
  await advance(page, 2, 3);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.getByRole('radio', { name: 'Trades' }).click();
  await expect(
    page.getByRole('table', { name: 'BTCUSDT recent trades' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'BTCUSDT order book' }),
  ).toBeHidden();
  await advance(page, 3, 3);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.05');
});

test('returning to BTC does not keep the live 100.05', async ({ page }) => {
  await openRun(page, 'symbol-return');
  await advance(page, 1, 5);
  await advance(page, 2, 5);
  await advance(page, 3, 5);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.05');
  await advance(page, 4, 5);
  await expect(page.getByLabel('ETHUSDT ticker')).toBeVisible();
  await advance(page, 5, 5);
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.00');
  await expect(page.getByLabel('BTCUSDT ticker')).not.toContainText('100.05');
  await expect(page).toHaveURL(/\/BTCUSDT(?:\?.*)?$/);
});
