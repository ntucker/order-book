import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import {
  firstWavePanels,
  firstWaveResponses,
  hydrateDashboard,
  secondWavePanels,
  secondWaveResponses,
} from './releases';

export const pendingSiblingLiveScenario: ScenarioDefinition = {
  id: 'pending-sibling-live',
  title: 'Live tick while a sibling is still pending',
  summary:
    'After the Header is live, a ticker update lands while Chart is still gated. On this app’s React 19.2.8 the pending Chart must stay a skeleton, not restart into an empty panel. Recorded for this React, not a lock for React 18 (3.4).',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'fast-panels',
      title: 'Fast panels paint',
      explanation: 'Header and Markets reveal. Chart, book, and trades stay pending.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      visibleSummary: ['Header'],
    },
    {
      id: 'hydrate-with-pending-chart',
      title: 'Hydrate with Chart still pending',
      explanation: 'A store publish from the socket manager / live tick is exactly the 2.4 wake-up shape.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Header interactive', 'Chart skeleton'],
    },
    {
      id: 'tick-with-pending-sibling',
      title: 'Live tick with Chart still loading',
      explanation:
        'The Header updates. Chart’s panel gate is still closed, so its hooks must not run and it must not flash a broken empty chart.',
      releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['ticker-header-price', 'watchlist-btc-price'],
      },
      storeSummary: ['Ticker:BTCUSDT 100.05'],
      visibleSummary: ['Header 100.05', 'Chart still ░░░░'],
    },
    {
      id: 'chart-reveals',
      title: 'Pending siblings reveal from their pieces',
      explanation: 'Slow panels fill from their snapshots without having fetched during the tick.',
      releases: [...secondWaveResponses, ...secondWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'chart' },
      visibleSummary: ['Chart', 'Header still 100.05'],
    },
  ],
};
