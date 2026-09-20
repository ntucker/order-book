'use client';

import { useRouter } from 'next/navigation';
import {
  createContext,
  use,
  useContext,
  useEffect,
  useMemo,
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
  ScenarioStatus,
} from '../shared/types';

type RuntimeListener = () => void;
type StreamListener = (
  command: Extract<ClientScenarioCommand, { kind: 'stream' }>,
) => void;

type Occurrence = ScenarioOccurrenceDescriptor & { element: HTMLElement };

type RuntimeSnapshot = {
  cursor: number;
  revision: number;
  status: ScenarioStatus['status'];
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
      revision: bootstrap.revision,
      status: bootstrap.status,
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
      revision: result.revision,
      status: result.status === 'complete' ? 'complete' : 'running',
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
      revision: Math.max(this.snapshotValue.revision, status.revision),
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
        await this.waitUntil(() =>
          window.location.pathname.endsWith(`/${predicate.symbol}`),
        );
        await afterPaint();
    }
  }

  markHydrated() {
    if (this.snapshotValue.hydrated) return;
    this.snapshotValue = { ...this.snapshotValue, hydrated: true };
    this.recordClientEvent({
      milestoneId: this.currentMilestoneId(),
      kind: 'visible',
      source: 'React',
      summary: 'Dashboard hydration committed',
    });
  }

  recordClientEvent(
    event: Pick<
      ScenarioEvent,
      'milestoneId' | 'kind' | 'source' | 'summary'
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
  const router = useRouter();
  useEffect(() => {
    runtime.setNavigate((symbol) => {
      router.push(
        `/scenarios/${bootstrap.scenarioId}/${bootstrap.runId}/${symbol}`,
      );
    });
  }, [bootstrap.runId, bootstrap.scenarioId, router, runtime]);
  return (
    <ScenarioRuntimeContext value={runtime}>
      {children}
    </ScenarioRuntimeContext>
  );
}

export function useScenarioRuntime(): ScenarioRuntime | null {
  return useContext(ScenarioRuntimeContext);
}

export function requireScenarioRuntime(): ScenarioRuntime {
  const runtime = useScenarioRuntime();
  if (!runtime) throw new Error('Scenario runtime is not available');
  return runtime;
}

export function ScenarioHydrationGate({ children }: { children: ReactNode }) {
  const runtime = requireScenarioRuntime();
  if (typeof window !== 'undefined') use(runtime.hydrationPromise);
  return children;
}

export function DashboardHydratedMarker() {
  const runtime = useScenarioRuntime();
  useEffect(() => runtime?.markHydrated(), [runtime]);
  return null;
}

const panelPromises = new Map<string, Promise<unknown>>();

export function ScenarioPanelGate({ panelId }: { panelId: string }) {
  const runtime = useScenarioRuntime();
  if (!runtime) return null;
  const key = `${runtime.bootstrap.runId}:${panelId}`;
  let promise = panelPromises.get(key);
  if (!promise) {
    promise = fetch(
      `${runtime.bootstrap.origin}/api/scenarios/${runtime.bootstrap.runId}/panel/${panelId}`,
      { cache: 'no-store' },
    ).then((response) => {
      if (!response.ok) throw new Error(`Panel gate failed: ${panelId}`);
      return response.json();
    });
    panelPromises.set(key, promise);
  }
  use(promise);
  return <i hidden data-scenario-panel={panelId} />;
}

export function useScenarioOccurrence(
  ref: RefObject<HTMLElement | null>,
  descriptor: ScenarioOccurrenceDescriptor,
) {
  const runtime = useScenarioRuntime();
  const stableDescriptor = useRef(descriptor);
  stableDescriptor.current = descriptor;
  useEffect(() => {
    const element = ref.current;
    if (!runtime || !element) return;
    element.dataset.scenarioOccurrence = descriptor.occurrenceId;
    return runtime.registerOccurrence(stableDescriptor.current, element);
  }, [descriptor.occurrenceId, ref, runtime]);
}
