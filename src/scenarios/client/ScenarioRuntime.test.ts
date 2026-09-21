import { describe, expect, it } from 'vitest';

import type { ScenarioBootstrap } from '../shared/types';
import { ScenarioRuntime } from './ScenarioRuntime';

function bootstrap(): ScenarioBootstrap {
  return {
    runId: 'run',
    scenarioId: 's',
    title: 't',
    posture: 'record',
    cursor: 1,
    origin: 'http://localhost',
    initialSymbol: 'BTCUSDT',
    milestones: [
      {
        id: 'm',
        cursor: 1,
        title: 't',
        explanation: 'e',
        releases: [],
        completesWhen: {
          kind: 'occurrences-painted',
          occurrenceIds: ['never'],
        },
      },
    ],
    events: [],
  };
}

describe('ScenarioRuntime cleanup', () => {
  it('rejects an in-flight waiter instead of hanging after dispose', async () => {
    const runtime = new ScenarioRuntime(bootstrap());
    const pending = runtime.waitForCompletion({
      kind: 'occurrences-painted',
      occurrenceIds: ['never'],
    });
    runtime.cleanup();
    await expect(pending).rejects.toThrow('Scenario runtime ended');
  });
});
