import type { ScenarioDefinition } from '../shared/types';
import { lateServerMergeScenario } from './late-server-merge';
import { streamedRevealScenario } from './streamed-reveal';
import { symbolTransitionScenario } from './symbol-transition';

const definitions: ScenarioDefinition[] = [
  streamedRevealScenario,
  lateServerMergeScenario,
  symbolTransitionScenario,
];

export const scenarioDefinitions = Object.fromEntries(
  definitions.map((definition) => [definition.id, definition]),
) as Record<string, ScenarioDefinition>;

export function getScenarioDefinition(id: string): ScenarioDefinition {
  const definition = scenarioDefinitions[id];
  if (!definition) throw new Error(`Unknown scenario "${id}"`);
  return definition;
}
