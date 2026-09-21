import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import {
  firstWavePanels,
  firstWaveResponses,
  hydrateDashboard,
  secondWavePanels,
  secondWaveResponses,
} from './releases';

export const liveAfterHydrateScenario: ScenarioDefinition = {
  id: 'live-after-hydrate',
  title: 'Live after first panels hydrate',
  summary:
    'Watchlist is clickable and ticking while the Book is still a skeleton. Production’s one-shot blob cannot do this; this run scripts invariant 2.3. Recorded reconstruction, not a master lock.',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'fast-panels',
      title: 'Fast panels paint',
      explanation: 'Markets and Header reveal from the first wave.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      visibleSummary: ['Markets', 'Header'],
    },
    {
      id: 'hydrate-fast-path',
      title: 'Hydrate before the book',
      explanation:
        'The browser takes over as soon as the first panels have data. Remaining panel gates stay closed.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Header interactive', 'Book skeleton'],
    },
    {
      id: 'live-while-book-pending',
      title: 'Live tick while the book is pending',
      explanation:
        'A ticker update reaches Header, Watchlist, and — once it exists — Book mid. The Book panel itself must still be a skeleton.',
      releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['ticker-header-price', 'watchlist-btc-price'],
      },
      storeSummary: ['Ticker:BTCUSDT 100.05'],
      visibleSummary: ['Header 100.05▲', 'Book still ░░░░'],
    },
    {
      id: 'book-arrives-live',
      title: 'Book arrives already behind live ticker',
      explanation: 'Slow snapshots reveal. The Header must stay 100.05, not jump back to 100.00.',
      releases: [...secondWaveResponses, ...secondWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      visibleSummary: ['Book', 'Header still 100.05'],
    },
  ],
};
