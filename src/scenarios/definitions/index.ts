import type { ScenarioDefinition } from '../shared/types';
import { hiddenPaneSubscriptionsScenario } from './hidden-pane-subscriptions';
import {
  handoffOutcomeAScenario,
  handoffOutcomeBScenario,
  handoffOutcomeCScenario,
} from './handoff-outcomes';
import { lateServerMergeScenario } from './late-server-merge';
import { liveAfterHydrateScenario } from './live-after-hydrate';
import { pendingSiblingLiveScenario } from './pending-sibling-live';
import { rapidBookUpdatesScenario } from './rapid-book-updates';
import { readinessFromRecordsScenario } from './readiness-from-records';
import {
  routeHScenario,
  routeWFetchNowScenario,
  routeWWaitScenario,
} from './bucket3-routes';
import { streamedRevealScenario } from './streamed-reveal';
import { suspendKeepsPictureScenario } from './suspend-keeps-picture';
import { symbolReturnScenario } from './symbol-return';
import { symbolTransitionScenario } from './symbol-transition';

const definitions: ScenarioDefinition[] = [
  streamedRevealScenario,
  lateServerMergeScenario,
  symbolTransitionScenario,
  readinessFromRecordsScenario,
  suspendKeepsPictureScenario,
  rapidBookUpdatesScenario,
  handoffOutcomeAScenario,
  handoffOutcomeBScenario,
  handoffOutcomeCScenario,
  liveAfterHydrateScenario,
  hiddenPaneSubscriptionsScenario,
  pendingSiblingLiveScenario,
  routeHScenario,
  routeWFetchNowScenario,
  routeWWaitScenario,
  symbolReturnScenario,
];

export const scenarioDefinitions = Object.fromEntries(
  definitions.map((definition) => [definition.id, definition]),
) as Record<string, ScenarioDefinition>;

export function listScenarioDefinitions(): ScenarioDefinition[] {
  return definitions;
}

export function getScenarioDefinition(id: string): ScenarioDefinition {
  const definition = scenarioDefinitions[id];
  if (!definition) throw new Error(`Unknown scenario "${id}"`);
  return definition;
}
