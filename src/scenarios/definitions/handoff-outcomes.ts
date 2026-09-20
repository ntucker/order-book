import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import {
  firstWavePanels,
  firstWaveResponses,
  hydrateDashboard,
  secondWavePanels,
  secondWaveResponses,
} from './releases';

export const handoffOutcomeAScenario: ScenarioDefinition = {
  id: 'handoff-outcome-a',
  title: 'Handoff outcome A — wait for everything',
  summary:
    'Master’s usual race: the frame and the complete blob arrive together after the slowest request. Nothing streams. Recorded, not a lock — a blank page until the chart is ready is not acceptable.',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'everything-at-once',
      title: 'Entire page arrives in one beat',
      explanation:
        'Every response and panel gate opens together. The dashboard is still the loading frame until this beat, then Markets, Header, Book, Trades, and Chart appear at once.',
      releases: [
        ...firstWaveResponses,
        ...secondWaveResponses,
        ...firstWavePanels,
        ...secondWavePanels,
      ],
      completesWhen: { kind: 'panel-visible', panelId: 'chart' },
      storeSummary: ['All six answers'],
      visibleSummary: ['Everything at once'],
    },
    {
      id: 'dashboard-hydrated',
      title: 'Takeover after the complete blob',
      explanation:
        'Hydration matches the complete paint. Outcome A hides the incomplete-handoff bug by also hiding the frame until the end.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive complete page'],
    },
  ],
};

export const handoffOutcomeBScenario: ScenarioDefinition = {
  id: 'handoff-outcome-b',
  title: 'Handoff outcome B — conclude between waves',
  summary:
    'First wave paints and hydrates; book/trades/candles are still missing from the store when the client takes over. Recorded master race, not a lock.',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'first-wave-only',
      title: 'First wave paints',
      explanation:
        'Symbol info and the watchlist list resolve. Markets and Header paint. Slow panels stay skeletons.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      storeSummary: ['SymbolInfo', 'Ticker list'],
      visibleSummary: ['Markets', 'Header'],
    },
    {
      id: 'hydrate-incomplete',
      title: 'Hydrate with an incomplete store',
      explanation:
        'The client takes over after the first wave. Book, trades, and candles have not landed. This is the broken-handoff half of outcome B.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Header live', 'Book still skeleton'],
    },
    {
      id: 'second-wave',
      title: 'Second wave arrives late',
      explanation:
        'Slow snapshots and panels release. Because hydration already ran, those panels ask from an incomplete store — the ledger records the client requests.',
      releases: [...secondWaveResponses, ...secondWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      storeSummary: ['OrderBook', 'TradeFeed', 'Candles'],
      visibleSummary: ['Late book / trades / chart'],
    },
  ],
};

export const handoffOutcomeCScenario: ScenarioDefinition = {
  id: 'handoff-outcome-c',
  title: 'Handoff outcome C — conclude before anything started',
  summary:
    'Hydrate the empty store first, then wake every panel so hooks run and fetch. Server HTML for those panels is wasted. Recorded root-layout race, not a lock.',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'empty-handoff',
      title: 'Frame and empty store first',
      explanation:
        'The client takes over before any snapshot is released. Panels are still gated, so hooks have not run yet — the analog of the 101-byte blob arriving with the frame.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'command-applied' },
      storeSummary: ['Empty client store'],
      visibleSummary: ['Skeletons only'],
    },
    {
      id: 'panels-wake-and-fetch',
      title: 'Panels wake and fetch',
      explanation:
        'Every panel gate opens with the store still empty. Panels that suspend on symbol info or the watchlist list start those requests. Chained reads (ticker, book, trades, candles) cannot start until symbol info returns — that is the waterfall, recorded honestly.',
      releases: [...firstWavePanels, ...secondWavePanels],
      completesWhen: {
        kind: 'request-started',
        sources: ['symbol-info', 'tickers'],
      },
      storeSummary: ['Fetches in flight'],
      visibleSummary: ['Hooks ran; still skeletons'],
    },
    {
      id: 'responses-land',
      title: 'Responses land on the client fetches',
      explanation:
        'Snapshots release into the already-started requests. The person sees client-rendered panels; the server never got to reveal them with data.',
      releases: [...firstWaveResponses, ...secondWaveResponses],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      storeSummary: ['Client-fetched records'],
      visibleSummary: ['Header and Markets from browser data'],
    },
  ],
};
