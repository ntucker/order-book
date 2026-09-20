import { getScenarioSession } from '@/scenarios/server/registry';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const session = getScenarioSession(runId);
  if (!session) {
    return Response.json({ error: 'Unknown scenario run' }, { status: 404 });
  }
  return Response.json(session.status());
}
