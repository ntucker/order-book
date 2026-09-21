'use client';

import {
  createContext,
  use,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

import type {
  AdvanceResult,
  ClientScenarioCommand,
  CompletionPredicate,
  ScenarioBootstrap,
  ScenarioEvent,
  ScenarioOccurrenceDescriptor,
  ScenarioRelease,
  ScenarioRequestKind,
  ScenarioStatus,
} from '../shared/types';

type RuntimeListener = () => void;
type StreamListener = (
  command: Extract<ClientScenarioCommand, { kind: 'stream' }>,
) => void;

type Occurrence = ScenarioOccurrenceDescriptor & { element: HTMLElement };

type RuntimeSnapshot = {
  cursor: number;
  events: ScenarioEvent[];
  hydrated: boolean;
  occurrences: Occurrence[];
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function releasedGatesFromMilestones(
  milestones: ScenarioBootstrap['milestones'],
  cursor: number,
): Set<string> {
  const released = new Set<string>();
  for (const milestone of milestones.slice(0, cursor)) {
    for (const release of milestone.releases) {
      if (release.kind === 'response' || release.kind === 'panel') {
        released.add(release.gateId);
      }
    }
  }
  return released;
}

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (typeof requestAnimationFrame !== 'function') {
      setTimeout(done, 0);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(done);
    });
    setTimeout(done, 100);
  });
}

export class ScenarioRuntime {
  readonly bootstrap: ScenarioBootstrap;
  readonly hydrationPromise: Promise<void>;
  private resolveHydration: () => void;
  private listeners = new Set<RuntimeListener>();
  private streamListeners = new Set<StreamListener>();
  private occurrences = new Map<string, Occurrence>();
  private panelPromises = new Map<string, Promise<unknown>>();
  private releasedGates: Set<string>;
  private elementWaiters = new Set<() => void>();
  private clientSequence = 0;
  private snapshotValue: RuntimeSnapshot;
  private navigate?: (symbol: string) => void;
  private disposed = false;

  constructor(bootstrap: ScenarioBootstrap) {
    this.bootstrap = bootstrap;
    const hydration = deferred();
    this.hydrationPromise = hydration.promise;
    this.resolveHydration = hydration.resolve;
    this.releasedGates = releasedGatesFromMilestones(
      bootstrap.milestones,
      bootstrap.cursor,
    );
    const hydrationReleased = bootstrap.milestones
      .slice(0, bootstrap.cursor)
      .some((milestone) =>
        milestone.releases.some(
          (release) => release.kind === 'hydrate-dashboard',
        ),
      );
    if (hydrationReleased) hydration.resolve();
    this.snapshotValue = {
      cursor: bootstrap.cursor,
      events: bootstrap.events,
      hydrated: false,
      occurrences: [],
    };
  }

  subscribe = (listener: RuntimeListener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshotValue;

  setNavigate(navigate: (symbol: string) => void) {
    this.navigate = navigate;
    return () => {
      if (this.navigate === navigate) this.navigate = undefined;
    };
  }

  async advance(): Promise<AdvanceResult> {
    const response = await fetch(
      `/api/scenarios/${encodeURIComponent(this.bootstrap.runId)}/advance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedCursor: this.snapshotValue.cursor,
          commandId: crypto.randomUUID(),
        }),
      },
    );
    if (!response.ok) {
      const body = (await response.json()) as { error?: string };
      throw new Error(body.error ?? `Advance failed (${response.status})`);
    }
    const result = (await response.json()) as AdvanceResult;
    this.snapshotValue = {
      ...this.snapshotValue,
      cursor: result.cursor,
      events: this.mergeEvents(this.snapshotValue.events, result.events),
    };
    this.noteReleasedGates(result.milestone.releases);
    this.emit();
    for (const command of result.clientCommands) this.applyCommand(command);
    return result;
  }

  async refresh(): Promise<void> {
    const abort = new AbortController();
    const timer = window.setTimeout(() => abort.abort(), 250);
    try {
      const response = await fetch(
        `/api/scenarios/${encodeURIComponent(this.bootstrap.runId)}`,
        { cache: 'no-store', signal: abort.signal },
      );
      if (!response.ok) return;
      const status = (await response.json()) as ScenarioStatus;
      this.snapshotValue = {
        ...this.snapshotValue,
        events: this.mergeEvents(this.snapshotValue.events, status.events),
      };
      this.emit();
    } catch {
      // Abort or a full HTTP/1.1 connection pool must not freeze CompletesWhen.
    } finally {
      window.clearTimeout(timer);
    }
  }

  async waitForCompletion(predicate: CompletionPredicate): Promise<void> {
    switch (predicate.kind) {
      case 'command-applied':
        await afterPaint();
        return;
      case 'dashboard-hydrated':
        this.resolveHydration();
        try {
          await this.waitUntil(() => this.snapshotValue.hydrated, 15_000);
        } catch (caught) {
          if (
            caught instanceof Error &&
            caught.message === 'Timed out waiting for scenario condition'
          ) {
            throw new Error(
              'Timed out waiting for DashboardHydratedMarker after hydrate-dashboard',
            );
          }
          throw caught;
        }
        await afterPaint();
        return;
      case 'panel-visible':
        await this.waitForElement(
          `[data-scenario-panel="${CSS.escape(predicate.panelId)}"]`,
        );
        await afterPaint();
        return;
      case 'occurrences-painted':
        await this.waitUntil(() =>
          predicate.occurrenceIds.every((id) =>
            this.snapshotValue.events.some(
              (event) =>
                event.milestoneId === this.currentMilestoneId() &&
                event.occurrenceIds.includes(id) &&
                (event.kind === 'store-committed' || event.kind === 'command'),
            ),
          ),
        );
        await afterPaint();
        return;
      case 'navigation-committed':
        await this.waitForPathname(predicate.symbol);
        await afterPaint();
        return;
      case 'request-started':
        await this.waitForRequestStarted(predicate.sources);
        await afterPaint();
        return;
    }
  }

  markHydrated() {
    if (this.snapshotValue.hydrated) return;
    this.snapshotValue = { ...this.snapshotValue, hydrated: true };
    this.recordClientEvent({
      kind: 'visible',
      source: 'React',
      summary: 'Dashboard hydration committed',
    });
  }

  recordClientEvent(
    event: Pick<
      ScenarioEvent,
      'kind' | 'source' | 'summary'
    > &
      Partial<
        Pick<
          ScenarioEvent,
          'entityDiffs' | 'endpointDiffs' | 'occurrenceIds'
        >
      >,
  ) {
    const sequence = ++this.clientSequence;
    const complete: ScenarioEvent = {
      id: `${this.bootstrap.runId}:client:${sequence}`,
      sequence: 1_000_000 + sequence,
      phase: 'client',
      milestoneId: this.currentMilestoneId(),
      entityDiffs: [],
      endpointDiffs: [],
      occurrenceIds: [],
      ...event,
    };
    this.snapshotValue = {
      ...this.snapshotValue,
      events: this.mergeEvents(this.snapshotValue.events, [complete]),
    };
    this.emit();
  }

  subscribeStreams(listener: StreamListener) {
    this.streamListeners.add(listener);
    return () => this.streamListeners.delete(listener);
  }

  registerOccurrence(
    descriptor: ScenarioOccurrenceDescriptor,
    element: HTMLElement,
  ) {
    this.occurrences.set(descriptor.occurrenceId, {
      ...descriptor,
      element,
    });
    this.snapshotValue = {
      ...this.snapshotValue,
      occurrences: [...this.occurrences.values()],
    };
    this.emit();
    return () => {
      this.occurrences.delete(descriptor.occurrenceId);
      this.snapshotValue = {
        ...this.snapshotValue,
        occurrences: [...this.occurrences.values()],
      };
      this.emit();
    };
  }

  highlightOccurrences(ids: string[], pinnedId?: string | null) {
    for (const occurrence of this.occurrences.values()) {
      delete occurrence.element.dataset.scenarioHighlight;
      delete occurrence.element.dataset.scenarioIndex;
    }
    ids.forEach((id, index) => {
      const occurrence = this.occurrences.get(id);
      if (!occurrence) return;
      occurrence.element.dataset.scenarioHighlight =
        pinnedId === id ? 'pinned' : 'preview';
      if (pinnedId === id) {
        occurrence.element.dataset.scenarioIndex = String(index + 1);
      }
    });
  }

  getPanelGatePromise(panelId: string): Promise<unknown> {
    const gateId = `panel:${panelId}`;
    if (this.releasedGates.has(gateId)) {
      return Promise.resolve({ panelId, released: true });
    }
    let promise = this.panelPromises.get(panelId);
    if (promise) return promise;
    // Local waiters only. A hanging GET to this Next server deadlocks
    // `next dev` (the page render occupies the only request slot).
    promise = this.waitUntil(() => this.releasedGates.has(gateId)).then(() => ({
      panelId,
      released: true,
    }));
    this.panelPromises.set(panelId, promise);
    return promise;
  }

  attach() {
    this.disposed = false;
  }

  cleanup() {
    this.disposed = true;
    const listeners = [...this.listeners];
    this.listeners.clear();
    this.streamListeners.clear();
    this.occurrences.clear();
    this.panelPromises.clear();
    for (const disconnect of this.elementWaiters) disconnect();
    this.elementWaiters.clear();
    for (const listener of listeners) listener();
  }

  private noteReleasedGates(releases: ScenarioRelease[]) {
    for (const release of releases) {
      if (release.kind === 'response' || release.kind === 'panel') {
        this.releasedGates.add(release.gateId);
      }
    }
  }

  private applyCommand(command: ClientScenarioCommand) {
    switch (command.kind) {
      case 'hydrate-dashboard':
        this.resolveHydration();
        break;
      case 'stream':
        for (const listener of this.streamListeners) listener(command);
        break;
      case 'navigate':
        this.navigate?.(command.symbol);
        break;
    }
  }

  private currentMilestoneId() {
    return (
      this.bootstrap.milestones[this.snapshotValue.cursor - 1]?.id ??
      'bootstrap'
    );
  }

  private mergeEvents(current: ScenarioEvent[], next: ScenarioEvent[]) {
    const byId = new Map(current.map((event) => [event.id, event]));
    for (const event of next) byId.set(event.id, event);
    return [...byId.values()].sort((a, b) => a.sequence - b.sequence);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private waitUntil(test: () => boolean, timeoutMs = Infinity): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error('Scenario runtime ended'));
    }
    if (test()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer =
        timeoutMs < Infinity
          ? window.setTimeout(() => {
              unsubscribe();
              reject(new Error('Timed out waiting for scenario condition'));
            }, timeoutMs)
          : undefined;
      const unsubscribe = this.subscribe(() => {
        if (this.disposed) {
          if (timer) window.clearTimeout(timer);
          unsubscribe();
          reject(new Error('Scenario runtime ended'));
          return;
        }
        if (!test()) return;
        if (timer) window.clearTimeout(timer);
        unsubscribe();
        resolve();
      });
    });
  }

  private waitForElement(selector: string): Promise<Element> {
    if (this.disposed) {
      return Promise.reject(new Error('Scenario runtime ended'));
    }
    const current = document.querySelector(selector);
    if (current) return Promise.resolve(current);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, element?: Element) => {
        if (settled) return;
        settled = true;
        this.elementWaiters.delete(disconnect);
        observer.disconnect();
        if (error) reject(error);
        else resolve(element as Element);
      };
      const disconnect = () => finish(new Error('Scenario runtime ended'));
      const observer = new MutationObserver(() => {
        if (this.disposed) {
          finish(new Error('Scenario runtime ended'));
          return;
        }
        const element = document.querySelector(selector);
        if (!element) return;
        finish(undefined, element);
      });
      this.elementWaiters.add(disconnect);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  private waitForPathname(symbol: string): Promise<void> {
    const deadline = performance.now() + 15_000;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };
      const check = () => {
        if (this.disposed) {
          finish(new Error('Scenario runtime ended'));
        } else if (window.location.pathname.endsWith(`/${symbol}`)) {
          finish();
        } else if (performance.now() >= deadline) {
          finish(new Error(`Navigation to ${symbol} did not commit`));
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
  }

  private async waitForRequestStarted(
    sources: ScenarioRequestKind[],
  ): Promise<void> {
    if (!sources.length) {
      throw new Error('request-started predicate requires sources');
    }
    const milestoneId = this.currentMilestoneId();
    const seen = () =>
      sources.every((source) => {
        const startedEvents = this.snapshotValue.events.filter(
          (event) =>
            event.kind === 'request-started' && event.source === source,
        );
        if (!startedEvents.length) return false;
        const released = this.snapshotValue.events.some(
          (event) =>
            event.kind === 'response-released' && event.source === source,
        );
        // In-flight rows may be tagged with the previous cursor if the panel
        // GET resumed before this advance() response updated the client cursor.
        return (
          startedEvents.some((event) => event.milestoneId === milestoneId) ||
          !released
        );
      });
    try {
      await this.waitUntil(seen, 15_000);
    } catch (caught) {
      if (
        caught instanceof Error &&
        caught.message === 'Timed out waiting for scenario condition'
      ) {
        throw new Error(
          `Timed out waiting for request-started: ${sources.join(', ')}`,
        );
      }
      throw caught;
    }
  }
}

const ScenarioRuntimeContext = createContext<ScenarioRuntime | null>(null);

export function ScenarioRuntimeProvider({
  bootstrap,
  children,
}: {
  bootstrap: ScenarioBootstrap;
  children: ReactNode;
}) {
  const runtimeRef = useRef<ScenarioRuntime | null>(null);
  if (
    !runtimeRef.current ||
    runtimeRef.current.bootstrap.runId !== bootstrap.runId
  ) {
    runtimeRef.current?.cleanup();
    runtimeRef.current = new ScenarioRuntime(bootstrap);
  }
  const runtime = runtimeRef.current;
  useEffect(() => {
    runtime.attach();
    return () => runtime.cleanup();
  }, [runtime]);
  return (
    <ScenarioRuntimeContext value={runtime}>
      {children}
    </ScenarioRuntimeContext>
  );
}

export function useScenarioRuntime(): ScenarioRuntime | null {
  return useContext(ScenarioRuntimeContext);
}

export function useRequiredScenarioRuntime(): ScenarioRuntime {
  const runtime = useScenarioRuntime();
  if (!runtime) throw new Error('Scenario runtime is not available');
  return runtime;
}

export function useScenarioNavigation(navigate: (symbol: string) => void) {
  const runtime = useScenarioRuntime();
  useEffect(() => {
    if (!runtime) return;
    return runtime.setNavigate(navigate);
  }, [navigate, runtime]);
}

export function DashboardHydratedMarker() {
  const runtime = useScenarioRuntime();
  useEffect(() => {
    if (!runtime) return;
    let cancelled = false;
    void runtime.hydrationPromise.then(() => {
      if (!cancelled) runtime.markHydrated();
    });
    return () => {
      cancelled = true;
    };
  }, [runtime]);
  return null;
}

export function ScenarioPanelGate({
  panelId,
  children,
}: {
  panelId: string;
  children?: ReactNode;
}) {
  const runtime = useScenarioRuntime();
  if (typeof window === 'undefined') {
    return runtime ? <i hidden data-scenario-panel-pending={panelId} /> : children;
  }
  if (runtime) use(runtime.getPanelGatePromise(panelId));
  return (
    <>
      {runtime ? <i hidden data-scenario-panel={panelId} /> : null}
      {children}
    </>
  );
}

export function useScenarioOccurrence(
  ref: RefObject<HTMLElement | null>,
  descriptor: ScenarioOccurrenceDescriptor,
) {
  const runtime = useScenarioRuntime();
  const descriptorKey = JSON.stringify(descriptor);
  const readDescriptor = useEffectEvent(() => descriptor);
  useEffect(() => {
    const element = ref.current;
    if (!runtime || !element) return;
    const current = readDescriptor();
    return runtime.registerOccurrence(current, element);
  }, [descriptorKey, ref, runtime]);
}
