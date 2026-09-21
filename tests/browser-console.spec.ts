import { expect, test } from './fixtures';

const SCENARIOS = [
  { id: 'streamed-reveal', steps: 6 },
  { id: 'late-server-merge', steps: 4 },
  { id: 'symbol-transition', steps: 4 },
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

test.describe('next dev console', () => {
  test.describe.configure({ mode: 'serial' });

  test('launcher has no browser errors', async ({ page }) => {
    await page.goto('/scenarios');
    await expect(
      page.getByRole('heading', {
        name: 'Deterministic order-book scenarios',
      }),
    ).toBeVisible();
  });

  for (const scenario of SCENARIOS) {
    test(`${scenario.id} has no unexpected browser errors`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const runId = crypto.randomUUID();
      await page.goto(`/scenarios/${scenario.id}/${runId}/BTCUSDT`, {
        waitUntil: 'commit',
      });
      await expect(page.getByText('Time stopped')).toBeVisible();
      const runner = page.getByRole('region', { name: 'Scenario runner' });
      for (let step = 1; step <= scenario.steps; step++) {
        const button = page.getByRole('button', { name: 'Advance 1 milestone' });
        await expect(button).toBeEnabled();
        await button.click();
        await expect(page.getByRole('progressbar')).toHaveText(
          `${step} / ${scenario.steps}`,
          { timeout: 20_000 },
        );
      }
      await runner.getByRole('button').last().click();
      await expect(
        page.getByRole('heading', { name: 'Normalized store diff' }),
      ).toBeVisible();
    });
  }
});
