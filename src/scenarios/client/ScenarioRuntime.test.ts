import { describe, expect, it, vi } from 'vitest';

import type { ScenarioBootstrap } from '../shared/types';
import {
  canStreamPanel,
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

  it('does not cache a rejected gate promise after dispose', async () => {
    const runtime = new ScenarioRuntime(bootstrap());
    runtime.cleanup();
    const pending = runtime.getPanelGatePromise('ticker');
    const settled = pending.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    );
    await expect(
      Promise.race([settled, Promise.resolve('pending' as const)]),
    ).resolves.toBe('pending');
    runtime.attach();
    expect(runtime.getPanelGatePromise('ticker')).toBe(pending);
    const milestone = bootstrap().milestones[0];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
    await runtime.advance();
    await expect(pending).resolves.toEqual({
      panelId: 'ticker',
      released: true,
    });
  });

  it('keeps a pre-dispose gate thenable pending through attach', async () => {
    const runtime = new ScenarioRuntime(bootstrap());
    const pending = runtime.getPanelGatePromise('ticker');
    runtime.cleanup();
    runtime.attach();
    expect(runtime.getPanelGatePromise('ticker')).toBe(pending);
    const milestone = bootstrap().milestones[0];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
    await runtime.advance();
    await expect(pending).resolves.toEqual({
      panelId: 'ticker',
      released: true,
    });
  });

  it('accepts new waiters after attach following Strict Mode cleanup', async () => {
    const runtime = new ScenarioRuntime(bootstrap());
    runtime.cleanup();
    runtime.attach();
    const pending = runtime.getPanelGatePromise('ticker');
    const milestone = bootstrap().milestones[0];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
    await runtime.advance();
    await expect(pending).resolves.toEqual({
      panelId: 'ticker',
      released: true,
    });
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

describe('canStreamPanel', () => {
  it('does not stream a released panel while its response gate is closed', () => {
    const released = new Set(['panel:ticker', 'response:symbol-info']);
    expect(canStreamPanel('ticker', released)).toBe(false);
  });

  it('streams a panel only when its panel and response gates are open', () => {
    const released = new Set([
      'panel:ticker',
      'response:symbol-info',
      'response:ticker',
    ]);
    expect(canStreamPanel('ticker', released)).toBe(true);
  });

  it('does not stream wake-panels-before-data', () => {
    const released = new Set([
      'panel:book',
      'panel:depth',
      'panel:trades',
      'panel:chart',
      'response:symbol-info',
    ]);
    expect(canStreamPanel('book', released)).toBe(false);
    expect(canStreamPanel('chart', released)).toBe(false);
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

  it('returns the same promise for an already-open gate', async () => {
    const runtime = new ScenarioRuntime(bootstrap({ cursor: 1 }));
    expect(runtime.getPanelGatePromise('ticker')).toBe(
      runtime.getPanelGatePromise('ticker'),
    );
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
