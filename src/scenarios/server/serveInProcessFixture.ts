import type { ScenarioRequestKind } from '../shared/types';
import { recordFixtureRequest, writeOpenFixture } from './fixtureResponse';
import type { ScenarioSession } from './ScenarioSession';

const REGISTRY = Symbol.for('order-book.scenario-sessions');

function sessionById(runId: string): ScenarioSession | undefined {
  const root = globalThis as typeof globalThis & {
    [REGISTRY]?: { sessions?: Map<string, ScenarioSession> };
  };
  return root[REGISTRY]?.sessions?.get(runId);
}

export async function serveInProcessFixture(
  runId: string,
  kind: ScenarioRequestKind,
  search: string,
): Promise<Response> {
  const session = sessionById(runId);
  if (!session) {
    return new Response(JSON.stringify({ error: 'Unknown scenario run' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const gateId = session.scenario.fixtures.responseGates[kind];
  // Do not wait — SSR cannot POST Advance until the document finishes.
  if (gateId && !session.isGateReleased(gateId)) {
    throw new DOMException('Response gate closed', 'AbortError');
  }
  recordFixtureRequest(session, kind);
  return writeOpenFixture(session, kind, new URLSearchParams(search));
}
