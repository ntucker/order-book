import type {
  ActionTypes,
  Manager,
  Middleware,
  State,
} from '@data-client/react';

import { diffEndpoints, diffEntities } from '../shared/diffState';
import type { ScenarioRuntime } from './ScenarioRuntime';

function actionSource(action: ActionTypes): string {
  if ('endpoint' in action) {
    return action.endpoint.name || action.type;
  }
  if ('schema' in action) {
    const schema = action.schema as { key?: string };
    return schema?.key ?? action.type;
  }
  return action.type;
}

export class EventLedgerManager implements Manager {
  constructor(private runtime: ScenarioRuntime) {}

  middleware: Middleware = (controller) => (next) => async (action) => {
    const before = controller.getState() as State<unknown>;
    this.runtime.recordClientEvent({
      kind: 'action-dispatched',
      source: actionSource(action),
      summary: action.type,
    });
    await next(action);
    const after = controller.getState() as State<unknown>;
    const entityDiffs = diffEntities(before, after);
    const endpointDiffs = diffEndpoints(before, after);
    if (entityDiffs.length || endpointDiffs.length) {
      const occurrences = this.runtime
        .getSnapshot()
        .occurrences.filter((occurrence) =>
          occurrence.entityPaths.some((path) =>
            entityDiffs.some(
              (diff) => diff.entityKey === path.key && diff.pk === path.pk,
            ),
          ),
        )
        .map((occurrence) => occurrence.occurrenceId);
      this.runtime.recordClientEvent({
        kind: 'store-committed',
        source: actionSource(action),
        summary: `${entityDiffs.length} entities · ${endpointDiffs.length} endpoints`,
        entityDiffs,
        endpointDiffs,
        occurrenceIds: occurrences,
      });
    }
  };

  cleanup() {}
}
