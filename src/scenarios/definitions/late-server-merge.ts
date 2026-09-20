import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';

export const lateServerMergeScenario: ScenarioDefinition = {
  id: 'late-server-merge',
  title: 'Newer live state wins',
  summary:
    'See an older update arrive after newer live data without regressing the normalized store or visible prices.',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures(),
  milestones: [
    {
      id: 'dashboard-visible',
      title: 'Server dashboard paints',
      explanation:
        'All initial snapshots resolve together to establish a clear baseline.',
      releases: [
        { kind: 'response', gateId: 'response:symbol-info' },
        { kind: 'response', gateId: 'response:tickers' },
        { kind: 'response', gateId: 'response:ticker' },
        { kind: 'response', gateId: 'response:book' },
        { kind: 'response', gateId: 'response:trades' },
        { kind: 'response', gateId: 'response:candles' },
        { kind: 'panel', gateId: 'panel:watch' },
        { kind: 'panel', gateId: 'panel:ticker' },
        { kind: 'panel', gateId: 'panel:book' },
        { kind: 'panel', gateId: 'panel:depth' },
        { kind: 'panel', gateId: 'panel:trades' },
        { kind: 'panel', gateId: 'panel:chart' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      storeSummary: ['Initial normalized market state'],
      visibleSummary: ['Complete BTC dashboard'],
    },
    {
      id: 'dashboard-hydrated',
      title: 'Live subscriptions start',
      explanation:
        'Hydration adopts the server values and activates the scripted stream manager.',
      releases: [{ kind: 'hydrate-dashboard' }],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive dashboard'],
    },
    {
      id: 'newer-live-update',
      title: 'Newer live data commits',
      explanation:
        'A newer book sequence and ticker price update the normalized entities.',
      releases: [
        { kind: 'stream', eventId: 'book-newer' },
        { kind: 'stream', eventId: 'ticker-newer' },
      ],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: [
          'ticker-header-price',
          'watchlist-btc-price',
          'book-mid-price',
        ],
      },
      storeSummary: ['OrderBook:BTCUSDT #520', 'Ticker:BTCUSDT'],
      visibleSummary: ['Header', 'Watchlist', 'Book'],
    },
    {
      id: 'older-update-rejected',
      title: 'Older update arrives and is rejected',
      explanation:
        'The incoming book sequence is visible in the causal log, but Entity.shouldUpdate keeps the newer normalized record.',
      releases: [{ kind: 'stream', eventId: 'book-older' }],
      completesWhen: { kind: 'command-applied' },
      storeSummary: ['OrderBook remains #520'],
      visibleSummary: ['No price regression'],
    },
  ],
};
