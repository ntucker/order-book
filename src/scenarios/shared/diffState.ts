import type { State } from '@data-client/react';

import type {
  EndpointDiff,
  EntityDiff,
  ValueDiff,
} from './types';

function same(a: unknown, b: unknown): boolean {
  return Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);
}

function leafDiffs(
  before: unknown,
  after: unknown,
  path: (string | number)[] = [],
  depth = 0,
): ValueDiff[] {
  if (same(before, after)) return [];
  if (depth > 4) return [{ path, before, after }];
  if (
    before &&
    after &&
    typeof before === 'object' &&
    typeof after === 'object' &&
    !Array.isArray(before) &&
    !Array.isArray(after)
  ) {
    const beforeRecord = before as Record<string, unknown>;
    const afterRecord = after as Record<string, unknown>;
    const keys = new Set([
      ...Object.keys(beforeRecord),
      ...Object.keys(afterRecord),
    ]);
    return [...keys].flatMap((key) =>
      leafDiffs(
        beforeRecord[key],
        afterRecord[key],
        [...path, key],
        depth + 1,
      ),
    );
  }
  return [{ path, before, after }];
}

export function diffEntities(
  before: State<unknown>,
  after: State<unknown>,
): EntityDiff[] {
  const entityKeys = new Set([
    ...Object.keys(before.entities),
    ...Object.keys(after.entities),
  ]);
  const changes: EntityDiff[] = [];
  for (const entityKey of entityKeys) {
    const beforeTable = before.entities[entityKey] ?? {};
    const afterTable = after.entities[entityKey] ?? {};
    const pks = new Set([
      ...Object.keys(beforeTable),
      ...Object.keys(afterTable),
    ]);
    for (const pk of pks) {
      const previous = beforeTable[pk];
      const next = afterTable[pk];
      if (same(previous, next)) continue;
      changes.push({
        entityKey,
        pk,
        change:
          previous === undefined
            ? 'added'
            : next === undefined
              ? 'removed'
              : 'updated',
        changedFields: leafDiffs(previous, next),
      });
    }
  }
  return changes;
}

export function diffEndpoints(
  before: State<unknown>,
  after: State<unknown>,
): EndpointDiff[] {
  const keys = new Set([
    ...Object.keys(before.endpoints),
    ...Object.keys(after.endpoints),
    ...Object.keys(before.meta),
    ...Object.keys(after.meta),
  ]);
  const changes: EndpointDiff[] = [];
  for (const endpointKey of keys) {
    const resultDiff = leafDiffs(
      before.endpoints[endpointKey],
      after.endpoints[endpointKey],
    );
    const meta = leafDiffs(
      before.meta[endpointKey],
      after.meta[endpointKey],
    );
    if (!resultDiff.length && !meta.length) continue;
    changes.push({
      endpointKey,
      result: resultDiff[0],
      meta,
    });
  }
  return changes;
}
