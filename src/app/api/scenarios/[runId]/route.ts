import { getScenarioSession } from '@/scenarios/server/registry';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const session = getScenarioSession(runId);
  if (!session) {
    return Response.json({ error: 'Unknown scenario run' }, { status: 404 });
  }
  const url = new URL(request.url);
  const after = Number(url.searchParams.get('after') ?? 0);
  const status = session.status();
  return Response.json({
    ...status,
    events: after > 0 ? session.eventsSince(after) : status.events,
  });
}
