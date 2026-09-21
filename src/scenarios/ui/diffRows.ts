import type {
  EndpointDiff,
  EntityDiff,
  ScenarioEvent,
  ValueDiff,
} from '../shared/types';

export interface DiffRow {
  key: string;
  label: string;
  diff: ValueDiff;
}

function entityRows(event: ScenarioEvent, diff: EntityDiff, diffIndex: number) {
  const fields = diff.changedFields.length
    ? diff.changedFields
    : [undefined];
  return fields.map((field, fieldIndex) => {
    const path = field?.path.join('.') ?? '';
    return {
      key: `${event.id}:entity:${diffIndex}:${fieldIndex}:${diff.entityKey}:${diff.pk}:${path}`,
      label: `${diff.entityKey}:${diff.pk} · ${path || diff.change}`,
      diff: field ?? {},
    };
  });
}

function endpointRows(
  event: ScenarioEvent,
  diff: EndpointDiff,
  diffIndex: number,
) {
  const rows: DiffRow[] = [];
  if (diff.result) {
    rows.push({
      key: `${event.id}:endpoint:${diffIndex}:result`,
      label: `${diff.endpointKey} · result`,
      diff: diff.result,
    });
  }
  diff.meta.forEach((field, fieldIndex) => {
    rows.push({
      key: `${event.id}:endpoint:${diffIndex}:meta:${fieldIndex}:${field.path.join('.')}`,
      label: `${diff.endpointKey} · meta.${field.path.join('.')}`,
      diff: field,
    });
  });
  return rows;
}

export function diffTableRows(events: ScenarioEvent[]): DiffRow[] {
  return events.flatMap((event) => [
    ...event.entityDiffs.flatMap((diff, diffIndex) =>
      entityRows(event, diff, diffIndex),
    ),
    ...event.endpointDiffs.flatMap((diff, diffIndex) =>
      endpointRows(event, diff, diffIndex),
    ),
  ]);
}
