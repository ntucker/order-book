import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import {
  firstWavePanels,
  firstWaveResponses,
  hydrateDashboard,
  secondWavePanels,
  secondWaveResponses,
} from './releases';

export const routeHScenario: ScenarioDefinition = {
  id: 'route-h',
  title: 'Route H — do not wake pending panels',
  summary:
    'Data travels with each panel. Hydrate the revealed Header, then tick, while Chart’s gate stays closed. Chart must not appear in the request ledger until its own piece. Bucket 3 option, not a lock.',
  posture: 'option',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'revealed-with-data',
      title: 'Revealed panels arrive with their data',
      explanation: 'Wire order: first-wave responses then their panels. Pending Chart code stays idle.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      visibleSummary: ['Markets', 'Header'],
    },
    {
      id: 'hydrate-revealed-only',
      title: 'Hydrate without opening pending gates',
      explanation: 'Live updates may publish to the revealed Header. Chart’s gate is still closed, so Route H holds.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Header interactive', 'Chart idle'],
    },
    {
      id: 'live-on-revealed',
      title: 'Live update on revealed panels only',
      explanation:
        'Ticker 100.05 paints. The candles request must not have started — a miss on Chart is still in the future, not a fetch.',
      releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['ticker-header-price', 'watchlist-btc-price'],
      },
      storeSummary: ['Ticker:BTCUSDT'],
      visibleSummary: ['Header 100.05', 'No Chart fetch'],
    },
    {
      id: 'pending-piece',
      title: 'Pending piece lands with its panel',
      explanation: 'Book, trades, and candles release with their panels. Now Chart may request, and only now.',
      releases: [...secondWaveResponses, ...secondWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'chart' },
      visibleSummary: ['Chart from its piece'],
    },
  ],
};

export const routeWFetchNowScenario: ScenarioDefinition = {
  id: 'route-w-fetch-now',
  title: 'Route W — fetch now',
  summary:
    'Wake pending panels before their snapshots. Each woken suspending panel fetches immediately and waits on the response gate. Today’s master. Option, not a lock — the ledger records the extra request-started rows.',
  posture: 'option',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'fast-path',
      title: 'Fast panels paint',
      explanation: 'Markets and Header reveal with their data.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      visibleSummary: ['Header'],
    },
    {
      id: 'hydrate',
      title: 'Hydrate',
      explanation: 'Client store takes over the revealed panels.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive Header'],
    },
    {
      id: 'wake-pending-panels',
      title: 'Wake pending panels before their data',
      explanation:
        'Book, trades, and chart gates open while their responses are still closed. useSuspense starts fetches. The ledger must show book/trades/candles request-started before response-released.',
      releases: [...secondWavePanels],
      completesWhen: {
        kind: 'request-started',
        sources: ['book', 'trades', 'candles'],
      },
      storeSummary: ['Slow fetches in flight'],
      visibleSummary: ['Woken panels still skeletons'],
    },
    {
      id: 'fetched-snapshots',
      title: 'Fetched snapshots land',
      explanation:
        'Responses release into the already-started client requests. There is no visible number swap here because fixtures match; the cost is the extra request, recorded in the ledger.',
      releases: [...secondWaveResponses],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['book-panel'],
      },
      visibleSummary: ['Book from client fetch'],
    },
  ],
};

export const routeWWaitScenario: ScenarioDefinition = {
  id: 'route-w-wait',
  title: 'Route W — wait on the piece',
  summary:
    'Same wake-up as fetch-now, but the response gate holds the already-started fetch until the piece. Honest analog of “wait”: this runtime cannot skip the FETCH, it can only delay the body. Option, not a 4090 waiter.',
  posture: 'option',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'fast-path',
      title: 'Fast panels paint',
      explanation: 'Markets and Header reveal with their data.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      visibleSummary: ['Header'],
    },
    {
      id: 'hydrate',
      title: 'Hydrate',
      explanation: 'Client takes over revealed panels.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive Header'],
    },
    {
      id: 'wake-and-wait',
      title: 'Woken panels wait on still-closed snapshots',
      explanation:
        'Pending panel gates open. Fetches start and hang on response gates — delayed fetch, not a readiness waiter. Browser-only reads do not exist in this app, so there is no extra “wait for the page” tax to show.',
      releases: [...secondWavePanels],
      completesWhen: {
        kind: 'request-started',
        sources: ['book', 'trades', 'candles'],
      },
      storeSummary: ['request-started, no response-released'],
      visibleSummary: ['Skeletons while the piece is outstanding'],
    },
    {
      id: 'piece-releases-waiters',
      title: 'Piece lands and the hung fetches complete',
      explanation:
        'Releasing the snapshots is this framework’s “piece arrived”. Zero second requests; the first fetch completes. A true per-key waiter would have skipped request-started entirely (HOLD data-client 4090).',
      releases: [...secondWaveResponses],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['book-panel'],
      },
      visibleSummary: ['Book from the held fetch'],
    },
  ],
};
