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
  }: { params: Promise<{ runId: string; kind: string }> },
) {
  const { runId, kind: rawKind } = await params;
  if (!KINDS.has(rawKind as ScenarioRequestKind)) {
    return Response.json({ error: 'Unknown fixture kind' }, { status: 404 });
  }
  const kind = rawKind as ScenarioRequestKind;
  const session = getScenarioSession(runId);
  if (!session) {
    return Response.json({ error: 'Unknown scenario run' }, { status: 404 });
  }
  const url = new URL(request.url);
  session.record({
    milestoneId: session.currentMilestoneId(),
    phase: 'server',
    kind: 'request-started',
    source: kind,
    summary: `${kind} request started`,
  });

  const gateId = session.scenario.fixtures.responseGates[kind];
  if (gateId) await session.waitForGate(gateId, request.signal);
  const body = fixtureResponse(session, kind, url.searchParams);
  session.record({
    milestoneId: session.currentMilestoneId(),
    phase: 'server',
    kind: 'response-released',
    source: kind,
    summary: `${kind} response released`,
  });
  return Response.json(body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
