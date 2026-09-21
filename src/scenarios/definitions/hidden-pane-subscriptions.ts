import type { ScenarioDefinition } from '../shared/types';
import { baseFixtures } from './fixtures';
import { completeServerDashboard, hydrateDashboard } from './releases';

export const hiddenPaneSubscriptionsScenario: ScenarioDefinition = {
  id: 'hidden-pane-subscriptions',
  title: 'Hidden mobile pane stays subscribed',
  summary:
    'On a phone the pane switcher hides Book/Chart/Trades with CSS, but the components stay mounted. A live tick still updates the Header while Trades is showing. Recorded app behavior, not invariant 1.3 as written (unsubscribe when off screen).',
  posture: 'record',
  initialSymbol: 'BTCUSDT',
  fixtures: baseFixtures,
  milestones: [
    {
      id: 'dashboard-visible',
      title: 'Server dashboard paints',
      explanation: 'All panels mount, including those CSS will hide on a narrow viewport.',
      releases: completeServerDashboard,
      completesWhen: { kind: 'panel-visible', panelId: 'book' },
      visibleSummary: ['Complete BTC dashboard'],
    },
    {
      id: 'dashboard-hydrated',
      title: 'Subscriptions start for every mounted panel',
      explanation:
        'useLive subscribes in an effect. Hidden panes are display:none, not unmounted, so their streams stay referenced.',
      releases: [hydrateDashboard],
      completesWhen: { kind: 'dashboard-hydrated' },
      visibleSummary: ['Interactive dashboard'],
    },
    {
      id: 'tick-while-book-hidden',
      title: 'Ticker updates while another pane is showing',
      explanation:
        'The e2e run switches to the Trades pane first. This beat still paints Header and Watchlist — proof the live feed did not follow “what is on screen”.',
      releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
      completesWhen: {
        kind: 'occurrences-painted',
        occurrenceIds: ['ticker-header-price', 'watchlist-btc-price'],
      },
      storeSummary: ['Ticker:BTCUSDT'],
      visibleSummary: ['Header 100.05 while Trades pane showing'],
    },
  ],
};
