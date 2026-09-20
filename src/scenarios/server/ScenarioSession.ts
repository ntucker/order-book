import type {
  AdvanceCommand,
  AdvanceResult,
  ClientScenarioCommand,
  CompiledScenario,
  ScenarioEvent,
  ScenarioStatus,
} from '../shared/types';

type Waiter = {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  abort?: () => void;
};

const MAX_EVENTS = 300;
const MAX_COMMANDS = 50;

export class StaleScenarioCursorError extends Error {}

export class ScenarioSession {
  readonly runId: string;
  readonly scenario: CompiledScenario;
  cursor = 0;
  lastTouched = Date.now();
  private sequence = 0;
  private released = new Set<string>();
  private waiters = new Map<string, Set<Waiter>>();
  private events: ScenarioEvent[] = [];
  private commands = new Map<string, AdvanceResult>();
  private disposed = false;

  constructor(runId: string, scenario: CompiledScenario) {
    this.runId = runId;
    this.scenario = scenario;
  }

  waitForGate(gateId: string, signal?: AbortSignal): Promise<void> {
    this.touch();
    if (this.disposed) {
      return Promise.reject(new Error(`Scenario run "${this.runId}" ended`));
    }
    if (this.released.has(gateId)) return Promise.resolve();
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, signal };
      if (signal) {
        waiter.abort = () => {
          this.removeWaiter(gateId, waiter);
          reject(new DOMException('Aborted', 'AbortError'));
        };
        signal.addEventListener('abort', waiter.abort, { once: true });
      }
      const gateWaiters = this.waiters.get(gateId) ?? new Set<Waiter>();
      gateWaiters.add(waiter);
      this.waiters.set(gateId, gateWaiters);
    });
  }

  advance(command: AdvanceCommand): AdvanceResult {
    this.touch();
    const replay = this.commands.get(command.commandId);
    if (replay) return replay;
    if (this.disposed) throw new Error(`Scenario run "${this.runId}" ended`);
    if (command.expectedCursor !== this.cursor) {
      throw new StaleScenarioCursorError(
        `Expected cursor ${this.cursor}, received ${command.expectedCursor}`,
      );
    }

    const milestone = this.scenario.milestones[this.cursor];
    if (!milestone) {
      throw new StaleScenarioCursorError('Scenario is already complete');
    }

    const clientCommands: ClientScenarioCommand[] = [];
    for (const release of milestone.releases) {
      switch (release.kind) {
        case 'response':
        case 'panel':
          this.releaseGate(release.gateId);
          break;
        case 'hydrate-dashboard':
          clientCommands.push({ kind: 'hydrate-dashboard' });
          break;
        case 'stream': {
          const event = this.scenario.fixtures.streamEvents[release.eventId];
          clientCommands.push({
            kind: 'stream',
            eventId: release.eventId,
            event,
          });
          break;
        }
        case 'navigate':
          clientCommands.push({ kind: 'navigate', symbol: release.symbol });
          break;
      }
    }

    this.cursor += 1;
    const event = this.record({
      milestoneId: milestone.id,
      phase: 'server',
      kind: 'command',
      source: 'ScenarioSession',
      summary: `Released milestone ${this.cursor}: ${milestone.title}`,
    });
    const result: AdvanceResult = {
      cursor: this.cursor,
      milestone,
      clientCommands,
      events: [event],
    };
    this.commands.set(command.commandId, result);
    if (this.commands.size > MAX_COMMANDS) {
      this.commands.delete(this.commands.keys().next().value as string);
    }
    return result;
  }

  record(
    event: Omit<
      ScenarioEvent,
      | 'id'
      | 'sequence'
      | 'entityDiffs'
      | 'endpointDiffs'
      | 'occurrenceIds'
    > &
      Partial<
        Pick<
          ScenarioEvent,
          'entityDiffs' | 'endpointDiffs' | 'occurrenceIds'
        >
      >,
  ): ScenarioEvent {
    this.touch();
    const sequence = ++this.sequence;
    const complete: ScenarioEvent = {
      id: `${this.runId}:server:${sequence}`,
      sequence,
      entityDiffs: [],
      endpointDiffs: [],
      occurrenceIds: [],
      ...event,
    };
    this.events.push(complete);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
    return complete;
  }

  currentMilestoneId() {
    return this.scenario.milestones[this.cursor - 1]?.id ?? 'bootstrap';
  }

  status(): ScenarioStatus {
    return {
      runId: this.runId,
      scenarioId: this.scenario.id,
      title: this.scenario.title,
      posture: this.scenario.posture,
      cursor: this.cursor,
      milestones: this.scenario.milestones,
      events: [...this.events],
    };
  }

  dispose(reason: 'complete' | 'expired' | 'aborted') {
    if (this.disposed) return;
    this.disposed = true;
    for (const waiters of this.waiters.values()) {
      for (const waiter of waiters) {
        waiter.reject(new Error(`Scenario ${reason}`));
        this.detachAbort(waiter);
      }
    }
    this.waiters.clear();
  }

  private releaseGate(gateId: string) {
    if (this.released.has(gateId)) return;
    this.released.add(gateId);
    const waiters = this.waiters.get(gateId);
    if (!waiters) return;
    this.waiters.delete(gateId);
    for (const waiter of waiters) {
      this.detachAbort(waiter);
      waiter.resolve();
    }
  }

  private removeWaiter(gateId: string, waiter: Waiter) {
    const waiters = this.waiters.get(gateId);
    if (!waiters) return;
    waiters.delete(waiter);
    if (!waiters.size) this.waiters.delete(gateId);
  }

  private detachAbort(waiter: Waiter) {
    if (waiter.signal && waiter.abort) {
      waiter.signal.removeEventListener('abort', waiter.abort);
    }
  }

  private touch() {
    this.lastTouched = Date.now();
  }
}
