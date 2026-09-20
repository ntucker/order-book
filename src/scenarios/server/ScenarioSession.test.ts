import { describe, expect, it, vi } from 'vitest';

import { streamedRevealScenario } from '../definitions/streamed-reveal';
import { compileScenario } from '../shared/compileScenario';
import {
  ScenarioSession,
  StaleScenarioCursorError,
} from './ScenarioSession';

function makeSession() {
  return new ScenarioSession(
    'test-run',
    compileScenario(streamedRevealScenario),
  );
}

describe('ScenarioSession', () => {
  it('latches a release for a waiter that starts later', async () => {
    const session = makeSession();
    session.advance({ expectedCursor: 0, commandId: 'one' });
    await expect(session.waitForGate('response:ticker')).resolves.toBeUndefined();
  });

  it('replays duplicate command ids without advancing twice', () => {
    const session = makeSession();
    const first = session.advance({ expectedCursor: 0, commandId: 'same' });
    const replay = session.advance({ expectedCursor: 0, commandId: 'same' });
    expect(replay).toEqual(first);
    expect(session.cursor).toBe(1);
  });

  it('rejects stale cursors', () => {
    const session = makeSession();
    session.advance({ expectedCursor: 0, commandId: 'one' });
    expect(() =>
      session.advance({ expectedCursor: 0, commandId: 'two' }),
    ).toThrow(StaleScenarioCursorError);
  });

  it('releases active waiters exactly once', async () => {
    const session = makeSession();
    const resolved = vi.fn();
    const waiting = session.waitForGate('response:ticker').then(resolved);
    session.advance({ expectedCursor: 0, commandId: 'one' });
    await waiting;
    expect(resolved).toHaveBeenCalledOnce();
  });

  it('honors aborted waiters', async () => {
    const session = makeSession();
    const abort = new AbortController();
    const waiting = session.waitForGate('response:book', abort.signal);
    abort.abort();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });
});
