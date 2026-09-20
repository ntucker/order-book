import { fixtureResponse } from '@/scenarios/server/fixtureResponse';
import { getScenarioSession } from '@/scenarios/server/registry';
import type { ScenarioRequestKind } from '@/scenarios/shared/types';

const KINDS = new Set<ScenarioRequestKind>([
  'symbol-info',
  'ticker',
  'tickers',
  'book',
  'trades',
  'candles',
]);

export async function GET(
  request: Request,
  {
    params,
  }: { params: Promise<{ runId: string; kind: ScenarioRequestKind }> },
) {
  const { runId, kind } = await params;
  if (!KINDS.has(kind)) {
    return Response.json({ error: 'Unknown fixture kind' }, { status: 404 });
  }
  const session = getScenarioSession(runId);
  if (!session) {
    return Response.json({ error: 'Unknown scenario run' }, { status: 404 });
  }
  const milestoneId =
    session.scenario.gateOwners[
      session.scenario.fixtures.responseGates[kind] ?? ''
    ] ?? 'bootstrap';
  const url = new URL(request.url);
  session.record({
    milestoneId,
    phase: 'server',
    kind: 'request-started',
    source: kind,
    summary: `${kind} request started`,
  });

  const gateId = session.scenario.fixtures.responseGates[kind];
  if (gateId) await session.waitForGate(gateId, request.signal);
  const body = fixtureResponse(session, kind, url.searchParams);
  session.record({
    milestoneId,
    phase: 'server',
    kind: 'response-released',
    source: kind,
    summary: `${kind} response released`,
  });
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
