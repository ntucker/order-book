import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';

export const symbolTransitionScenario: ScenarioDefinition = {
  id: 'symbol-transition',
  title: 'Concurrent symbol transition',
  summary:
    'BTC stays visible and live while ETH prepares, then the dashboard swaps as one committed transition.',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures(),
  milestones: [
    {
      id: 'btc-visible',
      title: 'BTC baseline paints',
      explanation: 'The complete BTC server snapshot establishes the baseline.',
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
      visibleSummary: ['Complete BTC dashboard'],
    },
    {
      id: 'btc-hydrated',
      title: 'BTC becomes live',
      explanation: 'Hydration starts subscriptions and enables navigation.',
      releases: [{ kind: 'hydrate-dashboard' }],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive BTC dashboard'],
    },
    {
      id: 'eth-navigation-starts',
      title: 'ETH navigation starts',
      explanation:
        'The real router transition marks ETH pending while BTC remains on screen.',
      releases: [{ kind: 'navigate', symbol: 'ETHUSDT' }],
      completesWhen: { kind: 'navigation-committed', symbol: 'ETHUSDT' },
      visibleSummary: ['ETH pending', 'BTC retained'],
    },
    {
      id: 'btc-updates-while-pending',
      title: 'BTC remains live while ETH prepares',
      explanation:
        'A BTC tick still reaches the retained dashboard during the transition.',
      releases: [{ kind: 'stream', eventId: 'btc-transition-tick' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['watchlist-btc-price'],
      },
      storeSummary: ['Ticker:BTCUSDT'],
      visibleSummary: ['Retained BTC values'],
    },
  ],
};
