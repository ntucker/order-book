import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import {
  hydrateDashboard,
  secondWavePanels,
  secondWaveResponses,
} from './releases';

export const readinessFromRecordsScenario: ScenarioDefinition = {
  id: 'readiness-from-records',
  title: 'Readiness comes from records',
  summary:
    'Header getTicker(BTC) is ready from the watchlist list’s Ticker:BTC record. The single-ticker response gate stays closed until after the header paints.',
  posture: 'lock',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'watchlist-list-lands',
      title: 'Watchlist list writes Ticker records',
      explanation:
        'getTickers is list-shaped, so it needs its own answer. That answer also writes Ticker:BTCUSDT into the shared store.',
      releases: [
        { kind: 'response', gateId: 'response:tickers' },
        { kind: 'panel', gateId: 'panel:watch' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'watch' },
      storeSummary: ['Ticker ×8 from getTickers'],
      visibleSummary: ['Markets list'],
    },
    {
      id: 'header-ready-from-record',
      title: 'Header ticker is ready without its request',
      explanation:
        'Symbol info returns, then the Header asks for getTicker(BTC). Ticker:BTCUSDT already exists, so the still-closed ticker gate is never waited on and the header paints 100.00.',
      releases: [
        { kind: 'response', gateId: 'response:symbol-info' },
        { kind: 'panel', gateId: 'panel:ticker' },
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      storeSummary: ['SymbolInfo:BTCUSDT', 'Ticker:BTCUSDT reused'],
      visibleSummary: ['Ticker header 100.00'],
    },
    {
      id: 'remaining-snapshot',
      title: 'Remaining snapshots and unused ticker gate',
      explanation:
        'Book, trades, and candles land. The ticker response gate is released only now, with no waiter — proving the Header never asked.',
      releases: [
        { kind: 'response', gateId: 'response:ticker' },
        ...secondWaveResponses,
        ...secondWavePanels,
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      storeSummary: ['OrderBook', 'TradeFeed', 'Candles'],
      visibleSummary: ['Complete dashboard'],
    },
    {
      id: 'dashboard-hydrated',
      title: 'Dashboard becomes interactive',
      explanation: 'Hydration starts live subscriptions on the already-painted values.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Live subscriptions'],
    },
  ],
};
