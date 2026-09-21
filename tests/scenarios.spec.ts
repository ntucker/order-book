import { expect, test, type Page } from '@playwright/test';

function documentScrollMetrics(page: Page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const shell = document.querySelector('.shell');
    const main = document.querySelector('main');
    return {
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      shellOverflow: shell ? getComputedStyle(shell).overflow : null,
      mainOverflow: main ? getComputedStyle(main).overflow : null,
    };
  });
}

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
  expect(chunk).not.toContain('100.00');
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
  await expect(
    page.getByRole('link', { name: /BTC.*100\.05/ }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: /One ticker update, three locations/ })
    .click();
  await expect(
    page.getByRole('heading', { name: /Normalized store diff/i }),
  ).toBeVisible();

  expect(binanceRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('scenario routes hide the live Order Book topbar', async ({ page }) => {
  await page.goto('/scenarios');
  await expect(page.locator('.shell > header')).toBeHidden();
  const heading = page.getByRole('heading', {
    name: 'Deterministic order-book scenarios',
  });
  await expect(heading).toBeVisible();
  const box = await heading.boundingBox();
  expect(box?.y, 'page title sits under leftover nav space').toBeLessThan(72);

  const runId = crypto.randomUUID();
  await page.goto(`/scenarios/streamed-reveal/${runId}/BTCUSDT`, {
    waitUntil: 'commit',
  });
  await expect(page.getByText('Time stopped')).toBeVisible();
  await expect(page.locator('.shell > header')).toBeHidden();

  await page.goto('/BTCUSDT', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('link', { name: 'Order Book' })).toBeVisible();
});

test('scenario launcher grid adds columns as the viewport grows', async ({
  page,
}) => {
  await page.goto('/scenarios');
  await expect(page.locator('[data-launcher-grid]')).toBeVisible();

  const measure = async (width: number) => {
    await page.setViewportSize({ width, height: 900 });
    return page.locator('[data-launcher-grid]').evaluate((grid) => {
      const columns = getComputedStyle(grid)
        .gridTemplateColumns.split(' ')
        .filter(Boolean).length;
      const cards = [...grid.querySelectorAll('article')];
      const gridBox = grid.getBoundingClientRect();
      const rightmost = cards.reduce((max, card) => {
        const right = card.getBoundingClientRect().right;
        return Math.max(max, right);
      }, 0);
      return {
        columns,
        leftover: gridBox.right - rightmost,
        gridWidth: gridBox.width,
      };
    });
  };

  const compact = await measure(700);
  const mid = await measure(1200);
  const wide = await measure(1680);
  expect(compact.columns).toBeGreaterThanOrEqual(2);
  expect(mid.columns).toBeGreaterThan(compact.columns);
  expect(wide.columns).toBeGreaterThan(mid.columns);
  expect(wide.columns).toBeGreaterThanOrEqual(5);
  expect(wide.leftover, 'dead band to the right of the last card').toBeLessThan(
    24,
  );
});

test('scenario launcher scrolls when the list is taller than the viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await page.goto('/scenarios');
  await expect(
    page.getByRole('heading', {
      name: 'Deterministic order-book scenarios',
    }),
  ).toBeVisible();
  const before = await documentScrollMetrics(page);
  expect(before.scrollHeight).toBeGreaterThan(before.innerHeight);
  expect(before.shellOverflow).toBe('visible');
  expect(before.mainOverflow).toBe('visible');

  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 700);
  await expect
    .poll(async () => (await documentScrollMetrics(page)).scrollY)
    .toBeGreaterThan(80);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page
    .getByRole('heading', { name: 'Deterministic order-book scenarios' })
    .click();
  await page.keyboard.press('PageDown');
  await expect
    .poll(async () => (await documentScrollMetrics(page)).scrollY)
    .toBeGreaterThan(80);
});

test('scenario loading frame stays inside the dashboard row', async ({
  page,
}) => {
  await page.goto('/scenarios');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 800, height: 900 },
  ] as const) {
    await page.setViewportSize(viewport);
    const measured = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return { overlap: Number.POSITIVE_INFINITY, frameHeight: 0 };
      main.innerHTML = `
        <div class="scenario-route">
          <div class="scenario-page">
            <div class="scenario-dashboard-frame"></div>
            <div data-console-row></div>
          </div>
        </div>
      `;
      const frame = document.querySelector('.scenario-dashboard-frame');
      const consoleRow = document.querySelector('[data-console-row]');
      if (!frame || !consoleRow) {
        return { overlap: Number.POSITIVE_INFINITY, frameHeight: 0 };
      }
      const frameBox = frame.getBoundingClientRect();
      return {
        overlap: frameBox.bottom - consoleRow.getBoundingClientRect().top,
        frameHeight: frameBox.height,
      };
    });
    expect(
      measured.frameHeight,
      `collapsed skeleton at ${viewport.width}px`,
    ).toBeGreaterThan(400);
    expect(
      measured.overlap,
      `console overlap at ${viewport.width}px`,
    ).toBeLessThanOrEqual(0.5);
  }
});

test('long scenario page scrolls with the document', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  const runId = crypto.randomUUID();
  await page.goto(`/scenarios/streamed-reveal/${runId}/BTCUSDT`, {
    waitUntil: 'commit',
  });
  await expect(page.getByText('Time stopped')).toBeVisible();
  const before = await documentScrollMetrics(page);
  expect(before.scrollHeight).toBeGreaterThan(before.innerHeight);
  expect(before.shellOverflow).toBe('visible');

  await page.mouse.move(640, 360);
  await page.mouse.wheel(0, 700);
  await expect
    .poll(async () => (await documentScrollMetrics(page)).scrollY)
    .toBeGreaterThan(80);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByText('Time stopped').click();
  await page.keyboard.press('PageDown');
  await expect
    .poll(async () => (await documentScrollMetrics(page)).scrollY)
    .toBeGreaterThan(80);
});

test('live dashboard keeps a locked desktop shell', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/BTCUSDT', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.shell')).toBeVisible();
  const metrics = await documentScrollMetrics(page);
  expect(metrics.shellOverflow).toBe('hidden');
  expect(metrics.mainOverflow).toBe('hidden');
});

test('scenario launcher creates an isolated run', async ({ page }) => {
  await page.goto('/scenarios');
  await expect(
    page.getByRole('heading', {
      name: 'Deterministic order-book scenarios',
    }),
  ).toBeVisible();
  const documentRequests: string[] = [];
  page.on('request', (request) => {
    if (
      request.resourceType() === 'document' &&
      request.url().includes('/scenarios/streamed-reveal/')
    ) {
      documentRequests.push(request.url());
    }
  });
  await page
    .getByRole('article')
    .filter({ hasText: 'Streamed reveal and handoff' })
    .getByRole('link', { name: /Open scenario/ })
    .click();
  await expect(page).toHaveURL(/\/scenarios\/streamed-reveal\/.+\/BTCUSDT$/);
  expect(
    documentRequests.some((url) =>
      /\/scenarios\/streamed-reveal\/[0-9a-f-]+\/BTCUSDT/i.test(url),
    ),
    'launcher must hard-navigate (full document load)',
  ).toBeTruthy();
  await expect(page.getByText('Time stopped')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();
  await page.getByRole('button', { name: 'Advance 1 milestone' }).click();
  await expect(page.getByText('1 / 6')).toBeVisible();
  await expect(page.getByLabel('BTCUSDT ticker')).toBeVisible();
});

test('scenario document uses streamed SSR handoff, not a client-only provider', async ({
  page,
  baseURL,
}) => {
  const runId = crypto.randomUUID();
  const response = await page.request.get(
    `${baseURL}/scenarios/streamed-reveal/${runId}/BTCUSDT`,
    { headers: { 'Accept-Encoding': 'identity' } },
  );
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('id="data-client-data"');
  expect(html).toContain('Deterministic scenario');
  expect(html).toContain('data-scenario-dashboard');
  expect(html).not.toContain('100.00');

  await page.goto(`/scenarios/streamed-reveal/${runId}/BTCUSDT`, {
    waitUntil: 'load',
  });
  await page.getByRole('button', { name: 'Advance 1 milestone' }).click();
  await expect(page.getByLabel('BTCUSDT ticker')).toContainText('100.00');
  await page.reload({ waitUntil: 'load' });
  const reloaded = await page.content();
  expect(reloaded).toContain('id="data-client-data"');
  expect(reloaded).toContain('100.00');
});

test('scenario run document finishes loading without waiting on gates', async ({
  page,
}) => {
  const runId = crypto.randomUUID();
  const started = Date.now();
  await page.goto(`/scenarios/streamed-reveal/${runId}/BTCUSDT`, {
    waitUntil: 'load',
    timeout: 15_000,
  });
  expect(Date.now() - started).toBeLessThan(15_000);
  await expect(page.getByText('Time stopped')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Advance 1 milestone' })).toBeEnabled();
});

const RELOAD_AFTER_WAKE = [
  { id: 'readiness-from-records', steps: 2, total: 3 },
  { id: 'handoff-outcome-c', steps: 2, total: 3 },
  { id: 'route-w-fetch-now', steps: 3, total: 4 },
] as const;

for (const scenario of RELOAD_AFTER_WAKE) {
  test(`reload after ${scenario.id} cursor ${scenario.steps} finishes without waiting on closed response gates`, async ({
    page,
  }) => {
    const runId = crypto.randomUUID();
    await page.goto(`/scenarios/${scenario.id}/${runId}/BTCUSDT`, {
      waitUntil: 'load',
      timeout: 15_000,
    });
    const advance = page.getByRole('button', { name: 'Advance 1 milestone' });
    for (let step = 1; step <= scenario.steps; step += 1) {
      await expect(advance).toBeEnabled();
      await advance.click();
      await expect(page.getByRole('progressbar')).toHaveText(
        `${step} / ${scenario.total}`,
      );
    }
    const started = Date.now();
    await page.reload({ waitUntil: 'load', timeout: 15_000 });
    expect(Date.now() - started).toBeLessThan(15_000);
    await expect(page.getByText('Time stopped')).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveText(
      `${scenario.steps} / ${scenario.total}`,
    );
    await expect(advance).toBeEnabled();
  });
}

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
  for (const step of [1, 2, 3]) {
    await advance.click();
    await expect(page.getByText(`${step} / 4`)).toBeVisible();
  }
  const book = page.getByRole('table', {
    name: 'BTCUSDT order book',
  });
  const expectUpdatedBook = async () => {
    await expect(book.getByText('100.04', { exact: true })).toBeVisible();
    await expect(book.getByText('100.06', { exact: true })).toBeVisible();
    await expect(book.getByText('100.05', { exact: true })).toBeVisible();
    await expect(
      book.getByText('Spread 0.02 · 2.00 bps', { exact: true }),
    ).toBeVisible();
  };
  await expectUpdatedBook();
  await advance.click();
  await expect(page.getByText('4 / 4')).toBeVisible();
  await expectUpdatedBook();
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
  let releaseEth!: () => void;
  const ethHeld = new Promise<void>((resolve) => {
    releaseEth = resolve;
  });
  let noteEthRequest!: () => void;
  const ethRequested = new Promise<void>((resolve) => {
    noteEthRequest = resolve;
  });
  await page.route(
    `**/scenarios/symbol-transition/${runId}/ETHUSDT*`,
    async (route) => {
      if (route.request().headers().rsc === '1') {
        noteEthRequest();
        await ethHeld;
      }
      await route.continue();
    },
  );
  await page.getByText('Auto', { exact: true }).click();
  await page.getByLabel('Milestone interval').selectOption('1000');
  await page
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await ethRequested;
  await expect(page.locator('[aria-busy="true"]')).toBeVisible();
  await expect(page.getByLabel('BTCUSDT ticker')).toBeVisible();
  await expect(
    page.getByRole('link', { name: /ETH/ }).first(),
  ).toHaveAttribute('data-pending', '');
  releaseEth();
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
