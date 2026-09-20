import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import {
  firstWavePanels,
  firstWaveResponses,
  hydrateDashboard,
  secondWavePanels,
  secondWaveResponses,
} from './releases';

export const suspendKeepsPictureScenario: ScenarioDefinition = {
  id: 'suspend-keeps-picture',
  title: 'Suspending takeover keeps the server picture',
  summary:
    'After the fast panels paint, hydration starts while the book is still gated. The Header stays the server’s 100.00 — never an empty or half-rendered panel.',
  posture: 'lock',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'fast-panels-painted',
      title: 'Fast panels paint on the server',
      explanation:
        'Symbol info and tickers resolve, then Markets and Header reveal. Book, trades, and chart stay pending.',
      releases: [...firstWaveResponses, ...firstWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'ticker' },
      visibleSummary: ['Markets', 'Ticker header'],
    },
    {
      id: 'hydrate-while-book-pending',
      title: 'Hydrate while the book is still pending',
      explanation:
        'The browser takes over. Pending book/trades/chart code stays idle behind their gates. The Header must remain the server-painted ticker, not a broken empty panel.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Header still 100.00', 'Book still skeleton'],
    },
    {
      id: 'slow-panels-reveal',
      title: 'Slow panels reveal afterward',
      explanation: 'The remaining snapshots and panel gates release without replacing the Header.',
      releases: [...secondWaveResponses, ...secondWavePanels],
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      visibleSummary: ['Book', 'Header unchanged'],
    },
  ],
};
