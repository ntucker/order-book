'use client';

import {
  createContext,
  use,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
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

function afterPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
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
  private clientSequence = 0;
  private snapshotValue: RuntimeSnapshot;
  private navigate?: (symbol: string) => void;

  constructor(bootstrap: ScenarioBootstrap) {
    this.bootstrap = bootstrap;
    const hydration = deferred();
    this.hydrationPromise = hydration.promise;
    this.resolveHydration = hydration.resolve;
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
    this.emit();
    for (const command of result.clientCommands) this.applyCommand(command);
    return result;
  }

  async refresh(): Promise<void> {
    const response = await fetch(
      `/api/scenarios/${encodeURIComponent(this.bootstrap.runId)}`,
      { cache: 'no-store' },
    );
    if (!response.ok) return;
    const status = (await response.json()) as ScenarioStatus;
    this.snapshotValue = {
      ...this.snapshotValue,
      events: this.mergeEvents(this.snapshotValue.events, status.events),
    };
    this.emit();
  }

  async waitForCompletion(predicate: CompletionPredicate): Promise<void> {
    switch (predicate.kind) {
      case 'command-applied':
        await afterPaint();
        return;
      case 'dashboard-hydrated':
        await this.waitUntil(() => this.snapshotValue.hydrated);
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
            this.occurrences.has(id),
          ),
        );
        await afterPaint();
        return;
      case 'navigation-committed':
        await this.waitForPathname(predicate.symbol);
        await afterPaint();
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
    let promise = this.panelPromises.get(panelId);
    if (promise) return promise;
    const requestOrigin =
      typeof window === 'undefined'
        ? this.bootstrap.origin
        : window.location.origin;
    promise = fetch(
      `${requestOrigin}/api/scenarios/${this.bootstrap.runId}/panel/${panelId}`,
      { cache: 'no-store' },
    )
      .then((response) => {
        if (!response.ok) throw new Error(`Panel gate failed: ${panelId}`);
        return response.json();
      })
      .catch((error) => {
        this.panelPromises.delete(panelId);
        throw error;
      });
    this.panelPromises.set(panelId, promise);
    return promise;
  }

  cleanup() {
    this.listeners.clear();
    this.streamListeners.clear();
    this.occurrences.clear();
    this.panelPromises.clear();
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

  private waitUntil(test: () => boolean): Promise<void> {
    if (test()) return Promise.resolve();
    return new Promise((resolve) => {
      const unsubscribe = this.subscribe(() => {
        if (!test()) return;
        unsubscribe();
        resolve();
      });
    });
  }

  private waitForElement(selector: string): Promise<Element> {
    const current = document.querySelector(selector);
    if (current) return Promise.resolve(current);
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (!element) return;
        observer.disconnect();
        resolve(element);
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    });
  }

  private waitForPathname(symbol: string): Promise<void> {
    const deadline = performance.now() + 15_000;
    return new Promise((resolve, reject) => {
      const check = () => {
        if (window.location.pathname.endsWith(`/${symbol}`)) {
          resolve();
        } else if (performance.now() >= deadline) {
          reject(new Error(`Navigation to ${symbol} did not commit`));
        } else {
          requestAnimationFrame(check);
        }
      };
      check();
    });
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
  const runtime = useMemo(() => new ScenarioRuntime(bootstrap), [bootstrap]);
  useEffect(() => () => runtime.cleanup(), [runtime]);
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

export function ScenarioHydrationGate({ children }: { children: ReactNode }) {
  const runtime = useRequiredScenarioRuntime();
  if (typeof window !== 'undefined') use(runtime.hydrationPromise);
  return children;
}

export function DashboardHydratedMarker() {
  const runtime = useScenarioRuntime();
  useEffect(() => runtime?.markHydrated(), [runtime]);
  return null;
}

export function ScenarioPanelGate({ panelId }: { panelId: string }) {
  const runtime = useScenarioRuntime();
  if (!runtime) return null;
  use(runtime.getPanelGatePromise(panelId));
  return <i hidden data-scenario-panel={panelId} />;
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
