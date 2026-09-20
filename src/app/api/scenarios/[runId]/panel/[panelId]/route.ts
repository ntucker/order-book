import { getScenarioSession } from '@/scenarios/server/registry';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string; panelId: string }> },
) {
  const { runId, panelId } = await params;
  const session = getScenarioSession(runId);
  if (!session) {
    return Response.json({ error: 'Unknown scenario run' }, { status: 404 });
  }
  const gateId = `panel:${panelId}`;
  await session.waitForGate(gateId, request.signal);
  return Response.json(
    { panelId, released: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
