import {
  recordFixtureRequest,
  writeOpenFixture,
} from '@/scenarios/server/fixtureResponse';
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
  const gateId = session.scenario.fixtures.responseGates[kind];
  recordFixtureRequest(session, kind);
  if (gateId) await session.waitForGate(gateId, request.signal);
  return writeOpenFixture(session, kind, new URL(request.url).searchParams);
}
