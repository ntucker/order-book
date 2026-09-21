import { afterEach, describe, expect, it } from 'vitest';

import { readinessFromRecordsScenario } from '../definitions/readiness-from-records';
import { compileScenario } from '../shared/compileScenario';
import { ScenarioSession } from './ScenarioSession';
import { serveInProcessFixture } from './serveInProcessFixture';

const REGISTRY = Symbol.for('order-book.scenario-sessions');

function plant(session: ScenarioSession) {
  const root = globalThis as typeof globalThis & {
    [REGISTRY]?: { sessions: Map<string, ScenarioSession> };
  };
  const sessions = new Map<string, ScenarioSession>([[session.runId, session]]);
  root[REGISTRY] = { sessions };
  return () => {
    sessions.delete(session.runId);
  };
}

describe('serveInProcessFixture', () => {
  let unplant: () => void;

  afterEach(() => {
    unplant?.();
  });

  it('does not wait on a still-closed response gate', async () => {
    const session = new ScenarioSession(
      'readiness-m2',
      compileScenario(readinessFromRecordsScenario),
    );
    unplant = plant(session);
    session.advance({ expectedCursor: 0, commandId: 'one' });
    session.advance({ expectedCursor: 1, commandId: 'two' });
    expect(session.isGateReleased('panel:ticker')).toBe(true);
    expect(session.isGateReleased('response:ticker')).toBe(false);

    const started = Date.now();
    await expect(
      serveInProcessFixture(session.runId, 'ticker', 'symbol=BTCUSDT'),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(Date.now() - started).toBeLessThan(50);
    expect(
      session
        .status()
        .events.filter(
          (event) =>
            event.source === 'ticker' &&
            (event.kind === 'request-started' ||
              event.kind === 'response-released'),
        ),
    ).toEqual([]);
  });

  it('serves a fixture when the response gate is already open', async () => {
    const session = new ScenarioSession(
      'readiness-m1',
      compileScenario(readinessFromRecordsScenario),
    );
    unplant = plant(session);
    session.advance({ expectedCursor: 0, commandId: 'one' });
    expect(session.isGateReleased('response:tickers')).toBe(true);

    const response = await serveInProcessFixture(
      session.runId,
      'tickers',
      'symbols=%5B%22BTCUSDT%22%5D',
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { symbol?: string }[];
    expect(body[0]?.symbol).toBe('BTCUSDT');
  });
});
