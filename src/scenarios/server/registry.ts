import 'server-only';

import { getScenarioDefinition } from '../definitions';
import { compileScenario } from '../shared/compileScenario';
import { ScenarioSession } from './ScenarioSession';

const REGISTRY = Symbol.for('order-book.scenario-sessions');
const IDLE_TTL_MS = 15 * 60 * 1000;

type Registry = {
  generation: number;
  sessions: Map<string, ScenarioSession>;
};

function registry(): Registry {
  const root = globalThis as typeof globalThis & {
    [REGISTRY]?: Registry;
  };
  return (root[REGISTRY] ??= {
    generation: 0,
    sessions: new Map(),
  });
}

function pruneIdle(reg: Registry) {
  const cutoff = Date.now() - IDLE_TTL_MS;
  for (const [runId, session] of reg.sessions) {
    if (session.lastTouched < cutoff) {
      session.dispose('expired');
      reg.sessions.delete(runId);
    }
  }
}

export function getOrCreateScenarioSession(
  runId: string,
  scenarioId: string,
): ScenarioSession {
  if (!/^[a-z0-9-]{4,80}$/i.test(runId)) {
    throw new Error('Invalid scenario run id');
  }
  const reg = registry();
  pruneIdle(reg);
  const existing = reg.sessions.get(runId);
  if (existing) {
    if (existing.scenario.id !== scenarioId) {
      throw new Error(`Run "${runId}" belongs to another scenario`);
    }
    return existing;
  }
  const scenario = compileScenario(getScenarioDefinition(scenarioId));
  const session = new ScenarioSession(runId, scenario, ++reg.generation);
  reg.sessions.set(runId, session);
  return session;
}

export function getScenarioSession(runId: string): ScenarioSession | undefined {
  const reg = registry();
  pruneIdle(reg);
  return reg.sessions.get(runId);
}
