import 'server-only';

import { getScenarioDefinition } from '../definitions';
import { compileScenario } from '../shared/compileScenario';
import { ScenarioSession } from './ScenarioSession';

const REGISTRY = Symbol.for('order-book.scenario-sessions');
const IDLE_TTL_MS = 15 * 60 * 1000;
const COMPLETE_TTL_MS = 5 * 60 * 1000;
const PRUNE_INTERVAL_MS = 60 * 1000;
const MAX_SESSIONS = 100;

type Registry = {
  sessions: Map<string, ScenarioSession>;
  pruneTimer?: ReturnType<typeof setInterval>;
};

function registry(): Registry {
  const root = globalThis as typeof globalThis & {
    [REGISTRY]?: Registry;
  };
  let reg = root[REGISTRY];
  if (!reg) {
    reg = {
      sessions: new Map(),
    };
    root[REGISTRY] = reg;
  }
  if (!reg.pruneTimer) {
    reg.pruneTimer = setInterval(() => pruneIdle(reg), PRUNE_INTERVAL_MS);
    reg.pruneTimer.unref?.();
  }
  return reg;
}

function pruneIdle(reg: Registry) {
  const now = Date.now();
  for (const [runId, session] of reg.sessions) {
    const complete =
      session.cursor >= session.scenario.milestones.length;
    const ttl = complete ? COMPLETE_TTL_MS : IDLE_TTL_MS;
    if (session.lastTouched < now - ttl) {
      session.dispose('expired');
      reg.sessions.delete(runId);
    }
  }
}

function enforceCapacity(reg: Registry) {
  if (reg.sessions.size < MAX_SESSIONS) return;
  const oldest = [...reg.sessions.entries()].sort(
    ([, left], [, right]) => left.lastTouched - right.lastTouched,
  )[0];
  if (!oldest) return;
  oldest[1].dispose('expired');
  reg.sessions.delete(oldest[0]);
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
  enforceCapacity(reg);
  const session = new ScenarioSession(runId, scenario);
  reg.sessions.set(runId, session);
  return session;
}

export function getScenarioSession(runId: string): ScenarioSession | undefined {
  const reg = registry();
  pruneIdle(reg);
  return reg.sessions.get(runId);
}
