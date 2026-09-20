import {
  StaleScenarioCursorError,
} from '@/scenarios/server/ScenarioSession';
import { getScenarioSession } from '@/scenarios/server/registry';
import type { AdvanceCommand } from '@/scenarios/shared/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const session = getScenarioSession(runId);
  if (!session) {
    return Response.json({ error: 'Unknown scenario run' }, { status: 404 });
  }

  let command: AdvanceCommand;
  try {
    command = (await request.json()) as AdvanceCommand;
  } catch {
    return Response.json({ error: 'Invalid command body' }, { status: 400 });
  }
  if (
    !Number.isInteger(command.expectedCursor) ||
    typeof command.commandId !== 'string' ||
    !command.commandId
  ) {
    return Response.json({ error: 'Invalid advance command' }, { status: 400 });
  }

  try {
    return Response.json(session.advance(command));
  } catch (error) {
    if (error instanceof StaleScenarioCursorError) {
      return Response.json(
        { error: error.message, cursor: session.cursor },
        { status: 409 },
      );
    }
    throw error;
  }
}
