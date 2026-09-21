import { test as base, expect, type Page } from '@playwright/test';

import { trackBrowserErrors, unexpectedBrowserErrors } from './browser-errors';

export { expect };

export async function waitForHydration(page: Page) {
  await page.waitForFunction(
    () => {
      const body = document.body;
      return (
        !!body && Object.keys(body).some((key) => key.startsWith('__react'))
      );
    },
    undefined,
    { timeout: 20_000 },
  );
}

export const test = base.extend({
  page: async ({ page }, expose) => {
    const errors = trackBrowserErrors(page);
    const goto = page.goto.bind(page);
    page.goto = async (...args: Parameters<Page['goto']>) => {
      const response = await goto(...args);
      await waitForHydration(page);
      return response;
    };
    await expose(page);
    expect(await unexpectedBrowserErrors(page, errors)).toEqual([]);
  },
});
