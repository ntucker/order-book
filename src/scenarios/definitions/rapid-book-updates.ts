import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import { completeServerDashboard, hydrateDashboard } from './releases';

export const rapidBookUpdatesScenario: ScenarioDefinition = {
  id: 'rapid-book-updates',
  title: 'Rapid book updates keep the newest book',
  summary:
    'Two depth updates a few beats apart. Only changed levels move; the screen never stutters back to the previous sequence.',
  posture: 'lock',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'dashboard-visible',
      title: 'Server dashboard paints',
      explanation: 'The complete BTC snapshot is the baseline book #500.',
      releases: completeServerDashboard,
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      visibleSummary: ['Complete BTC dashboard'],
    },
    {
      id: 'dashboard-hydrated',
      title: 'Live subscriptions start',
      explanation: 'Hydration adopts the snapshot and enables scripted depth events.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive dashboard'],
    },
    {
      id: 'first-depth-tick',
      title: 'First live depth update',
      explanation: 'Sequence #520 rewrites the inside of the book.',
      releases: [{ kind: 'stream', eventId: 'book-newer' }],
      completesWhen: { kind: 'occurrences-painted', occurrenceIds: ['book-panel'] },
      storeSummary: ['OrderBook:BTCUSDT #520'],
      visibleSummary: ['100.04 / 100.06'],
    },
    {
      id: 'second-depth-tick',
      title: 'Second live depth update',
      explanation:
        'Sequence #540 replaces the inside again. Unchanged rows keep identity; the book must not flash #520’s levels afterward.',
      releases: [{ kind: 'stream', eventId: 'book-newer-2' }],
      completesWhen: { kind: 'occurrences-painted', occurrenceIds: ['book-panel'] },
      storeSummary: ['OrderBook:BTCUSDT #540'],
      visibleSummary: ['100.07 / 100.08'],
    },
  ],
};
