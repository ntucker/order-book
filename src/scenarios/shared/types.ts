export type ScenarioCandleInterval =
  | '1m'
  | '5m'
  | '15m'
  | '1h'
  | '4h'
  | '1d';

export type ScenarioRequestKind =
  | 'symbol-info'
  | 'ticker'
  | 'tickers'
  | 'book'
  | 'trades'
  | 'candles';

export type ScenarioEventKind =
  | 'request-started'
  | 'response-released'
  | 'action-dispatched'
  | 'store-committed'
  | 'visible'
  | 'command';

export interface ValueDiff {
  path: (string | number)[];
  before?: unknown;
  after?: unknown;
}

export interface EntityDiff {
  entityKey: string;
  pk: string;
  change: 'added' | 'updated' | 'removed';
  changedFields: ValueDiff[];
}

export interface EndpointDiff {
  endpointKey: string;
  result?: ValueDiff;
  meta: ValueDiff[];
}

export interface ScenarioEvent {
  id: string;
  milestoneId: string;
  sequence: number;
  phase: 'server' | 'client';
  kind: ScenarioEventKind;
  source: string;
  summary: string;
  entityDiffs: EntityDiff[];
  endpointDiffs: EndpointDiff[];
  occurrenceIds: string[];
}

export type ScenarioRelease =
  | { kind: 'response'; gateId: string }
  | { kind: 'panel'; gateId: string }
  | { kind: 'hydrate-dashboard' }
  | { kind: 'stream'; eventId: string }
  | { kind: 'navigate'; symbol: string };

export type CompletionPredicate =
  | { kind: 'panel-visible'; panelId: string }
  | { kind: 'occurrences-painted'; occurrenceIds: string[] }
  | { kind: 'dashboard-hydrated' }
  | { kind: 'navigation-committed'; symbol: string }
  | { kind: 'command-applied' }
  | { kind: 'request-started'; sources: ScenarioRequestKind[] };

export interface ScenarioMilestoneDefinition {
  id: string;
  title: string;
  explanation: string;
  releases: ScenarioRelease[];
  completesWhen: CompletionPredicate;
  storeSummary?: string[];
  visibleSummary?: string[];
}

export interface ScenarioMarketFixture {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  tickSize: string;
  stepSize: string;
  ticker: Record<string, unknown>;
  book: {
    lastUpdateId: number;
    bids: [string, string][];
    asks: [string, string][];
  };
  trades: Record<string, unknown>[];
  candles: Record<ScenarioCandleInterval, unknown[][]>;
}

export interface ScenarioStreamFixture {
  stream: string;
  data: unknown;
  occurrenceIds?: string[];
}

export interface ScenarioFixtures {
  markets: Record<string, ScenarioMarketFixture>;
  watchlist: string[];
  responseGates: Partial<Record<ScenarioRequestKind, string>>;
  streamEvents: Record<string, ScenarioStreamFixture>;
}

export type ScenarioPosture = 'lock' | 'record' | 'option';

export interface ScenarioDefinition {
  id: string;
  title: string;
  summary: string;
  /**
   * How to read the run. Ledger diamonds mean "this step happened",
   * not "the invariant is satisfied".
   *
   * - `lock` — Bucket 1: assert the invariant on this path
   * - `record` — scripted timing / current master outcome; variable timing is the thesis
   * - `option` — Bucket 3 design choice, not a pass/fail lock
   */
  posture: ScenarioPosture;
  initialSymbol: string;
  fixtures: ScenarioFixtures;
  milestones: ScenarioMilestoneDefinition[];
}

export interface CompiledMilestone extends ScenarioMilestoneDefinition {
  cursor: number;
}

export interface CompiledScenario
  extends Omit<ScenarioDefinition, 'milestones'> {
  milestones: CompiledMilestone[];
  gateOwners: Record<string, string>;
}

export type ClientScenarioCommand =
  | { kind: 'hydrate-dashboard' }
  | { kind: 'stream'; eventId: string; event: ScenarioStreamFixture }
  | { kind: 'navigate'; symbol: string };

export interface AdvanceCommand {
  expectedCursor: number;
  commandId: string;
}

export interface AdvanceResult {
  cursor: number;
  milestone: CompiledMilestone;
  clientCommands: ClientScenarioCommand[];
  events: ScenarioEvent[];
}

export interface ScenarioStatus {
  runId: string;
  scenarioId: string;
  title: string;
  posture: ScenarioPosture;
  cursor: number;
  milestones: CompiledMilestone[];
  events: ScenarioEvent[];
}

export interface ScenarioBootstrap extends ScenarioStatus {
  origin: string;
  initialSymbol: string;
}

export interface ScenarioOccurrenceDescriptor {
  occurrenceId: string;
  entityPaths: { key: string; pk: string }[];
}
