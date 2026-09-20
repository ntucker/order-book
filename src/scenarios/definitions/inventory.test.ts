import { describe, expect, it } from 'vitest';

import { listScenarioDefinitions } from '../definitions';
import { compileScenario } from '../shared/compileScenario';

const EXPECTED_IDS = [
  'streamed-reveal',
  'late-server-merge',
  'symbol-transition',
  'readiness-from-records',
  'suspend-keeps-picture',
  'rapid-book-updates',
  'handoff-outcome-a',
  'handoff-outcome-b',
  'handoff-outcome-c',
  'live-after-hydrate',
  'hidden-pane-subscriptions',
  'pending-sibling-live',
  'route-h',
  'route-w-fetch-now',
  'route-w-wait',
  'symbol-return',
] as const;

describe('scenario inventory', () => {
  it('compiles every registered definition with unique ids', () => {
    const definitions = listScenarioDefinitions();
    expect(definitions.map((definition) => definition.id)).toEqual([
      ...EXPECTED_IDS,
    ]);
    const compiled = definitions.map((definition) => compileScenario(definition));
    expect(new Set(compiled.map((item) => item.id)).size).toBe(compiled.length);
    for (const scenario of compiled) {
      expect(scenario.posture).toMatch(/^(lock|record|option)$/);
      expect(scenario.milestones.length).toBeGreaterThan(0);
    }
  });
});
