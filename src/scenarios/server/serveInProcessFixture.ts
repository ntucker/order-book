import type { ScenarioRequestKind } from '../shared/types';
import { fixtureResponse } from './fixtureResponse';
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
  session.record({
    milestoneId: session.currentMilestoneId(),
    phase: 'server',
    kind: 'request-started',
    source: kind,
    summary: `${kind} request started`,
  });
  const gateId = session.scenario.fixtures.responseGates[kind];
  if (gateId) await session.waitForGate(gateId);
  const body = fixtureResponse(session, kind, new URLSearchParams(search));
  session.record({
    milestoneId: session.currentMilestoneId(),
    phase: 'server',
    kind: 'response-released',
    source: kind,
    summary: `${kind} response released`,
  });
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
