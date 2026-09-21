import { describe, expect, it } from 'vitest';

import { listScenarioDefinitions } from '../definitions';
import { compileScenario } from '../shared/compileScenario';

const EXPECTED = [
  ['streamed-reveal', 'lock'],
  ['late-server-merge', 'lock'],
  ['symbol-transition', 'lock'],
  ['readiness-from-records', 'lock'],
  ['rapid-book-updates', 'record'],
  ['handoff-outcome-a', 'record'],
  ['handoff-outcome-b', 'record'],
  ['handoff-outcome-c', 'record'],
  ['live-after-hydrate', 'record'],
  ['hidden-pane-subscriptions', 'record'],
  ['route-h', 'option'],
  ['route-w-fetch-now', 'option'],
  ['symbol-return', 'record'],
] as const;

describe('scenario inventory', () => {
  it('compiles every registered definition with unique ids and postures', () => {
    const definitions = listScenarioDefinitions();
    expect(
      definitions.map((definition) => [definition.id, definition.posture]),
    ).toEqual(EXPECTED.map(([id, posture]) => [id, posture]));
    const compiled = definitions.map((definition) =>
      compileScenario(definition),
    );
    expect(new Set(compiled.map((item) => item.id)).size).toBe(compiled.length);
  });
});
