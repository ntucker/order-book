import type {
  CompiledScenario,
  ScenarioDefinition,
  ScenarioRelease,
} from './types';

function releaseGate(release: ScenarioRelease): string | undefined {
  return release.kind === 'response' || release.kind === 'panel'
    ? release.gateId
    : undefined;
}

export function compileScenario(
  definition: ScenarioDefinition,
): CompiledScenario {
  if (!definition.id.trim()) throw new Error('Scenario id is required');
  if (!definition.posture) {
    throw new Error(`Scenario "${definition.id}" is missing posture`);
  }
  if (!definition.milestones.length) {
    throw new Error(`Scenario "${definition.id}" has no milestones`);
  }

  const milestoneIds = new Set<string>();
  const gateOwners: Record<string, string> = {};
  const streamIds = new Set(Object.keys(definition.fixtures.streamEvents));

  const milestones = definition.milestones.map((milestone, index) => {
    if (!milestone.id.trim()) throw new Error('Milestone id is required');
    if (milestoneIds.has(milestone.id)) {
      throw new Error(`Duplicate milestone "${milestone.id}"`);
    }
    milestoneIds.add(milestone.id);

    for (const release of milestone.releases) {
      const gateId = releaseGate(release);
      if (gateId) {
        if (gateOwners[gateId]) {
          throw new Error(
            `Gate "${gateId}" is owned by both "${gateOwners[gateId]}" and "${milestone.id}"`,
          );
        }
        gateOwners[gateId] = milestone.id;
      }
      if (release.kind === 'stream' && !streamIds.has(release.eventId)) {
        throw new Error(
          `Milestone "${milestone.id}" references unknown stream event "${release.eventId}"`,
        );
      }
    }

    if (
      milestone.completesWhen.kind === 'request-started' &&
      milestone.completesWhen.sources.length === 0
    ) {
      throw new Error(
        `Milestone "${milestone.id}" request-started predicate has no sources`,
      );
    }

    return Object.freeze({ ...milestone, cursor: index + 1 });
  });

  for (const gateId of Object.values(definition.fixtures.responseGates)) {
    if (gateId && !gateOwners[gateId]) {
      throw new Error(`Response gate "${gateId}" is never released`);
    }
  }

  return Object.freeze({
    ...definition,
    milestones,
    gateOwners,
  });
}
