import type { Page } from '@playwright/test';

const DEFERRED_SCENARIOS = new Set(['symbol-transition', 'symbol-return']);

const DEFERRED_MESSAGES = [
  "Can't perform a React state update on a component that hasn't mounted yet",
  'Action dispatched after unmount',
  'rdc/unsubscribe',
];

export function trackBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

function scenarioId(url: string) {
  return url.match(/\/scenarios\/([^/]+)\//)?.[1];
}

function deferred(id: string | undefined, text: string) {
  return (
    !!id &&
    DEFERRED_SCENARIOS.has(id) &&
    DEFERRED_MESSAGES.some((message) => text.includes(message))
  );
}

async function overlayText(page: Page) {
  return page
    .evaluate(() => {
      const portal = document.querySelector('nextjs-portal');
      const dialog = portal?.shadowRoot?.querySelector('[data-nextjs-dialog]');
      return dialog?.textContent?.trim() ?? '';
    })
    .catch(() => '');
}

function overlayProblem(id: string | undefined, overlay: string) {
  if (!overlay) return '';
  const issues = overlay.split('Console Error').slice(1);
  if (!issues.length) return overlay;
  return issues.some((issue) => !deferred(id, issue)) ? overlay : '';
}

export async function unexpectedBrowserErrors(page: Page, errors: string[]) {
  const id = scenarioId(page.url());
  const unexpected = errors.filter((text) => !deferred(id, text));
  const overlay = overlayProblem(id, await overlayText(page));
  return overlay ? [...unexpected, overlay] : unexpected;
}
