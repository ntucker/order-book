import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import { completeServerDashboard, hydrateDashboard } from './releases';

export const symbolReturnScenario: ScenarioDefinition = {
  id: 'symbol-return',
  title: 'Coming back to BTC after ETH',
  summary:
    'BTC → ETH → BTC. This app’s DataProvider lives on the page, so each committed navigation is a new store. Recorded 3.3 outcome: remembered numbers do not survive the remount; gates are already latched so the second BTC fetch is immediate.',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'btc-visible',
      title: 'BTC baseline paints',
      explanation: 'Complete BTC snapshot.',
      releases: completeServerDashboard,
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      visibleSummary: ['Complete BTC dashboard'],
    },
    {
      id: 'btc-hydrated',
      title: 'BTC becomes live',
      explanation: 'Hydration starts subscriptions. Response and panel gates latch open for the rest of this run.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive BTC'],
    },
    {
      id: 'btc-live-tick',
      title: 'BTC ticks to 100.05',
      explanation:
        'A live ticker write marks this store. If coming back showed remembered numbers, the Header would still say 100.05.',
      releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['ticker-header-price', 'watchlist-btc-price'],
      },
      storeSummary: ['Ticker:BTCUSDT 100.05'],
      visibleSummary: ['Header 100.05'],
    },
    {
      id: 'open-eth',
      title: 'Navigate to ETH',
      explanation:
        'The real router transition keeps BTC on screen until ETH commits. ETH SSR hits already-released gates.',
      releases: [{ kind: 'navigate', symbol: 'ETHUSDT' }],
      completesWhen: { kind: 'navigation-committed', symbol: 'ETHUSDT' },
      visibleSummary: ['ETH dashboard'],
    },
    {
      id: 'return-btc',
      title: 'Navigate back to BTC',
      explanation:
        'A new page tree and a new DataProvider. Library default “show remembered, refresh in background” cannot apply across that remount. BTC paints again from latched fixtures.',
      releases: [{ kind: 'navigate', symbol: 'BTCUSDT' }],
      completesWhen: { kind: 'navigation-committed', symbol: 'BTCUSDT' },
      visibleSummary: ['BTC 100.00 from fixtures, not 100.05'],
    },
  ],
};
