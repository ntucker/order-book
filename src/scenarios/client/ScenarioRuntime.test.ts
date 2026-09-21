import { describe, expect, it, vi } from 'vitest';

import type { ScenarioBootstrap } from '../shared/types';
import {
  releasedGatesFromMilestones,
  ScenarioRuntime,
} from './ScenarioRuntime';

function bootstrap(
  overrides: Partial<ScenarioBootstrap> = {},
): ScenarioBootstrap {
  return {
    runId: 'run',
    scenarioId: 's',
    title: 't',
    posture: 'record',
    cursor: 0,
    origin: 'http://localhost',
    initialSymbol: 'BTCUSDT',
    milestones: [
      {
        id: 'm',
        cursor: 1,
        title: 't',
        explanation: 'e',
        releases: [
          { kind: 'panel', gateId: 'panel:ticker' },
          { kind: 'response', gateId: 'response:ticker' },
        ],
        completesWhen: {
          kind: 'occurrences-painted',
          occurrenceIds: ['never'],
        },
      },
    ],
    events: [],
    ...overrides,
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

describe('releasedGatesFromMilestones', () => {
  it('only counts gates from already-advanced milestones', () => {
    const milestones = bootstrap().milestones;
    expect([...releasedGatesFromMilestones(milestones, 0)]).toEqual([]);
    expect([...releasedGatesFromMilestones(milestones, 1)]).toEqual([
      'panel:ticker',
      'response:ticker',
    ]);
  });
});

describe('ScenarioRuntime panel gates', () => {
  it('resolves panel gates from Advance releases without fetching', async () => {
    const milestone = bootstrap().milestones[0];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          cursor: 1,
          milestone,
          clientCommands: [],
          events: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const runtime = new ScenarioRuntime(bootstrap());
    const pending = runtime.getPanelGatePromise('ticker');
    await runtime.advance();
    await expect(pending).resolves.toEqual({
      panelId: 'ticker',
      released: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('/advance');
    fetchSpy.mockRestore();
  });

  it('treats already-advanced bootstrap gates as open', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const runtime = new ScenarioRuntime(bootstrap({ cursor: 1 }));
    await expect(runtime.getPanelGatePromise('ticker')).resolves.toEqual({
      panelId: 'ticker',
      released: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
