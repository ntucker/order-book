import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';

export const streamedRevealScenario: ScenarioDefinition = {
  id: 'streamed-reveal',
  title: 'Streamed reveal and handoff',
  summary:
    'Watch the shell, independent panels, hydration, and the first live update arrive as distinct teaching beats.',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures(),
  milestones: [
    {
      id: 'markets-visible',
      title: 'Markets and ticker reveal',
      explanation:
        'The shared symbol and ticker responses resolve, then both fast panels reveal from the server stream.',
      releases: [
        { kind: 'response', gateId: 'response:symbol-info' },
        { kind: 'response', gateId: 'response:tickers' },
        { kind: 'response', gateId: 'response:ticker' },
        { kind: 'panel', gateId: 'panel:watch' },
        { kind: 'panel', gateId: 'panel:ticker' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      storeSummary: ['Ticker ×8', 'SymbolInfo:BTCUSDT'],
      visibleSummary: ['Markets', 'Ticker header'],
    },
    {
      id: 'book-visible',
      title: 'Book and depth reveal',
      explanation:
        'The order-book snapshot normalizes once and feeds both book views.',
      releases: [
        { kind: 'response', gateId: 'response:book' },
        { kind: 'panel', gateId: 'panel:book' },
        { kind: 'panel', gateId: 'panel:depth' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      storeSummary: ['OrderBook:BTCUSDT'],
      visibleSummary: ['Order Book', 'Depth'],
    },
    {
      id: 'trades-visible',
      title: 'Recent trades reveal',
      explanation:
        'The trades response is released independently from the slower chart.',
      releases: [
        { kind: 'response', gateId: 'response:trades' },
        { kind: 'panel', gateId: 'panel:trades' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'trades' },
      storeSummary: ['TradeFeed:BTCUSDT'],
      visibleSummary: ['Trades'],
    },
    {
      id: 'chart-visible',
      title: 'Chart reveals last',
      explanation:
        'Candles complete the server-rendered dashboard without changing panels that already painted.',
      releases: [
        { kind: 'response', gateId: 'response:candles' },
        { kind: 'panel', gateId: 'panel:chart' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'chart' },
      storeSummary: ['Candles:BTCUSDT:1m'],
      visibleSummary: ['Chart'],
    },
    {
      id: 'dashboard-hydrated',
      title: 'Dashboard becomes interactive',
      explanation:
        'The browser adopts the server DOM and starts subscriptions without repainting the values.',
      releases: [{ kind: 'hydrate-dashboard' }],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Dashboard controls', 'Live subscriptions'],
    },
    {
      id: 'first-live-tick',
      title: 'One ticker update, three locations',
      explanation:
        'A single normalized Ticker update reaches every registered occurrence in one visible beat.',
      releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: [
          'ticker-header-price',
          'watchlist-btc-price',
          'book-mid-price',
        ],
      },
      storeSummary: ['Ticker:BTCUSDT'],
      visibleSummary: ['Header', 'Watchlist', 'Book mid'],
    },
  ],
};
