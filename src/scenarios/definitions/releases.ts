import type { ScenarioRelease } from '../shared/types';

export const firstWaveResponses: ScenarioRelease[] = [
  { kind: 'response', gateId: 'response:symbol-info' },
  { kind: 'response', gateId: 'response:tickers' },
  { kind: 'response', gateId: 'response:ticker' },
];

export const firstWavePanels: ScenarioRelease[] = [
  { kind: 'panel', gateId: 'panel:watch' },
  { kind: 'panel', gateId: 'panel:ticker' },
];

export const secondWaveResponses: ScenarioRelease[] = [
  { kind: 'response', gateId: 'response:book' },
  { kind: 'response', gateId: 'response:trades' },
  { kind: 'response', gateId: 'response:candles' },
];

export const secondWavePanels: ScenarioRelease[] = [
  { kind: 'panel', gateId: 'panel:book' },
  { kind: 'panel', gateId: 'panel:depth' },
  { kind: 'panel', gateId: 'panel:trades' },
  { kind: 'panel', gateId: 'panel:chart' },
];

export const allResponses: ScenarioRelease[] = [
  ...firstWaveResponses,
  ...secondWaveResponses,
];

export const allPanels: ScenarioRelease[] = [
  ...firstWavePanels,
  ...secondWavePanels,
];

export const hydrateDashboard: ScenarioRelease = {
  kind: 'hydrate-dashboard',
};

export const completeServerDashboard: ScenarioRelease[] = [
  ...allResponses,
  ...allPanels,
];
