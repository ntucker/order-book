'use client';

import { useSearchParams } from 'next/navigation';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  useRequiredScenarioRuntime,
} from '../client/ScenarioRuntime';
import { POSTURE_HINT, POSTURE_LABEL } from '../shared/posture';
import type { CompiledMilestone, ScenarioEvent } from '../shared/types';
import styles from './ScenarioConsole.module.css';

type Mode = 'manual' | 'auto';

function formatValue(value: unknown): string {
  if (value === undefined) return '—';
  if (typeof value === 'string') return value;
  try {
    const text = JSON.stringify(value);
    return text.length > 160 ? `${text.slice(0, 157)}…` : text;
  } catch {
    return String(value);
  }
}

function milestoneEvents(events: ScenarioEvent[], milestoneId: string) {
  return events.filter((event) => event.milestoneId === milestoneId);
}

function diffRows(events: ScenarioEvent[]) {
  return events.flatMap((event) => [
    ...event.entityDiffs.flatMap((diff) => {
      const fields = diff.changedFields.length ? diff.changedFields : [undefined];
      return fields.map((field) => {
        const path = field?.path.join('.') ?? '';
        return {
          label: `${diff.entityKey}:${diff.pk} · ${path || diff.change}`,
          before: field?.before,
          after: field?.after,
        };
      });
    }),
    ...event.endpointDiffs.flatMap((diff) => [
      ...(diff.result
        ? [{
            label: `${diff.endpointKey} · result`,
            before: diff.result.before,
            after: diff.result.after,
          }]
        : []),
      ...diff.meta.map((field) => ({
        label: `${diff.endpointKey} · meta.${field.path.join('.')}`,
        before: field.before,
        after: field.after,
      })),
    ]),
  ]);
}

function DiffTable({ events }: { events: ScenarioEvent[] }) {
  const rows = diffRows(events);
  if (!rows.length) {
    return <p className={styles.description}>No normalized values changed.</p>;
  }
  return (
    <table className={styles.diffTable}>
      <thead>
        <tr>
          <th>Record / path</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            <td className={styles.diffPath}>{row.label}</td>
            <td className={styles.diffBefore}>{formatValue(row.before)}</td>
            <td className={styles.diffAfter}>{formatValue(row.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EventInspector({
  milestone,
  events,
  occurrenceIds,
  pinnedOccurrence,
  onPreview,
  onPin,
  onLocate,
}: {
  milestone?: CompiledMilestone;
  events: ScenarioEvent[];
  occurrenceIds: string[];
  pinnedOccurrence: string | null;
  onPreview: (ids: string[]) => void;
  onPin: (id: string | null) => void;
  onLocate: () => void;
}) {
  if (!milestone) {
    return (
      <div className={styles.empty}>
        Select a milestone to inspect its causes and normalized store impact.
      </div>
    );
  }
  const causes = new Map<string, number>();
  for (const event of events) {
    const key = `${event.phase} · ${event.kind}`;
    causes.set(key, (causes.get(key) ?? 0) + 1);
  }
  return (
    <>
      <div className={styles.inspectorHeader}>
        <div>
          <h3 className={styles.inspectorTitle}>{milestone.title}</h3>
          <p className={styles.description}>{milestone.explanation}</p>
        </div>
        <span className={styles.status}>Step {milestone.cursor}</span>
      </div>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Affected views</h4>
        <div className={styles.chips}>
          {occurrenceIds.length ? (
            occurrenceIds.map((id) => (
              <button
                type="button"
                key={id}
                className={`${styles.chip} ${
                  pinnedOccurrence === id ? styles.chipActive : ''
                }`}
                onMouseEnter={() => onPreview([id])}
                onMouseLeave={() => onPreview([])}
                onFocus={() => onPreview([id])}
                onBlur={() => onPreview([])}
                onClick={() =>
                  onPin(pinnedOccurrence === id ? null : id)
                }
              >
                {id}
              </button>
            ))
          ) : (
            <span className={styles.description}>No registered view changes</span>
          )}
          {occurrenceIds.length ? (
            <button type="button" className={styles.chip} onClick={onLocate}>
              Locate ({occurrenceIds.length})
            </button>
          ) : null}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Causes</h4>
        <div className={styles.chips}>
          {[...causes].map(([label, count]) => (
            <span className={styles.chip} key={label}>
              {label} ×{count}
            </span>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Normalized store diff</h4>
        <DiffTable events={events} />
      </section>
    </>
  );
}

export default function ScenarioConsole() {
  const runtime = useRequiredScenarioRuntime();
  const searchParams = useSearchParams();
  const snapshot = useSyncExternalStore(
    runtime.subscribe,
    runtime.getSnapshot,
    runtime.getSnapshot,
  );
  const [mode, setMode] = useState<Mode>(
    searchParams.get('play') === 'auto' ? 'auto' : 'manual',
  );
  const [interval, setIntervalMs] = useState(
    Number(searchParams.get('interval')) || 2000,
  );
  const [playing, setPlaying] = useState(
    searchParams.get('running') === '1',
  );
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string>();
  const [selectedId, setSelectedId] = useState<string>();
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [pinnedOccurrence, setPinnedOccurrence] = useState<string | null>(null);
  const [locateIndex, setLocateIndex] = useState(-1);
  const consoleRef = useRef<HTMLElement>(null);

  const milestones = runtime.bootstrap.milestones;
  const selected = milestones.find((item) => item.id === selectedId);
  const selectedEvents = useMemo(
    () =>
      selected ? milestoneEvents(snapshot.events, selected.id) : [],
    [selected, snapshot.events],
  );
  const occurrenceIds = useMemo(
    () =>
      [...new Set(selectedEvents.flatMap((event) => event.occurrenceIds))],
    [selectedEvents],
  );
  const complete = snapshot.cursor >= milestones.length;

  useEffect(() => {
    const next = new URLSearchParams(window.location.search);
    if (mode === 'auto') next.set('play', 'auto');
    else next.delete('play');
    if (mode === 'auto') next.set('interval', String(interval));
    else next.delete('interval');
    if (mode === 'auto' && playing) next.set('running', '1');
    else next.delete('running');
    const query = next.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`,
    );
  }, [interval, mode, playing]);

  async function advanceOne() {
    if (busyRef.current || complete) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const result = await runtime.advance();
      setSelectedId(result.milestone.id);
      await runtime.waitForCompletion(result.milestone.completesWhen);
      runtime.recordClientEvent({
        kind: 'visible',
        source: 'ScenarioRunner',
        summary: `${result.milestone.title} visibly completed`,
      });
      void runtime.refresh();
    } catch (caught) {
      setPlaying(false);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const onAutoAdvance = useEffectEvent(() => {
    void advanceOne();
  });

  useEffect(() => {
    if (mode !== 'auto' || !playing || busy || complete) return;
    const timer = window.setTimeout(onAutoAdvance, interval);
    return () => window.clearTimeout(timer);
  }, [busy, complete, interval, mode, playing, snapshot.cursor]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const activeIds =
      pinnedOccurrence
        ? [pinnedOccurrence]
        : previewIds.length
          ? previewIds
          : selected
            ? occurrenceIds
            : [];
    runtime.highlightOccurrences(activeIds, pinnedOccurrence);
  }, [
    occurrenceIds,
    pinnedOccurrence,
    previewIds,
    runtime,
    selected,
    snapshot.occurrences.length,
  ]);

  function locate() {
    if (!occurrenceIds.length) return;
    const next = (locateIndex + 1) % occurrenceIds.length;
    const id = occurrenceIds[next];
    setLocateIndex(next);
    setPinnedOccurrence(id);
    const occurrence = snapshot.occurrences.find(
      (candidate) => candidate.occurrenceId === id,
    );
    occurrence?.element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }

  const onRunnerKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches('input, select, button, textarea')) return;
    const selectedIndex = milestones.findIndex(
      (milestone) => milestone.id === selectedId,
    );
    if (event.key.toLowerCase() === 'n' && mode === 'manual') {
      event.preventDefault();
      void advanceOne();
    } else if (event.key.toLowerCase() === 'p' && mode === 'auto') {
      event.preventDefault();
      setPlaying((value) => !value);
    } else if (event.key.toLowerCase() === 'j') {
      event.preventDefault();
      setSelectedId(
        milestones[Math.min(milestones.length - 1, selectedIndex + 1)]?.id,
      );
    } else if (event.key.toLowerCase() === 'k') {
      event.preventDefault();
      setSelectedId(milestones[Math.max(0, selectedIndex - 1)]?.id);
    } else if (event.key.toLowerCase() === 'l') {
      event.preventDefault();
      locate();
    } else if (event.key === 'Escape') {
      if (pinnedOccurrence) setPinnedOccurrence(null);
      else setSelectedId(undefined);
    }
  });

  useEffect(() => {
    const element = consoleRef.current;
    if (!element) return;
    element.addEventListener('keydown', onRunnerKeyDown);
    return () => element.removeEventListener('keydown', onRunnerKeyDown);
  }, []);

  const restart = () => {
    window.location.assign(
      `/scenarios/${runtime.bootstrap.scenarioId}/new/${runtime.bootstrap.initialSymbol}`,
    );
  };

  const statusLabel =
    error
      ? 'Failed'
      : complete
        ? 'Complete'
        : busy
          ? 'Advancing'
          : mode === 'manual'
            ? 'Time stopped'
            : playing
              ? 'Running'
              : 'Paused';

  return (
    <section
      ref={consoleRef}
      className={styles.console}
      aria-label="Scenario runner"
      aria-keyshortcuts="N P J K L Escape"
      tabIndex={0}
    >
      <header className={styles.toolbar}>
        <div className={styles.identity}>
          <div className={styles.titleBlock}>
            <span className={styles.eyebrow}>Deterministic scenario</span>
            <strong className={styles.title}>
              {runtime.bootstrap.title}
            </strong>
          </div>
          <span
            className={styles.posture}
            data-posture={runtime.bootstrap.posture}
            title={POSTURE_HINT[runtime.bootstrap.posture]}
          >
            {POSTURE_LABEL[runtime.bootstrap.posture]}
          </span>
          <span className={styles.status}>{statusLabel}</span>
          <span
            className={styles.progress}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={milestones.length}
            aria-valuenow={snapshot.cursor}
          >
            {snapshot.cursor} / {milestones.length}
          </span>
        </div>

        <div className={styles.controls}>
          <div className={styles.mode} aria-label="Playback mode">
            <label>
              <input
                type="radio"
                name="scenario-mode"
                value="auto"
                checked={mode === 'auto'}
                onChange={() => setMode('auto')}
              />
              Auto
            </label>
            <label>
              <input
                type="radio"
                name="scenario-mode"
                value="manual"
                checked={mode === 'manual'}
                onChange={() => {
                  setMode('manual');
                  setPlaying(false);
                }}
              />
              Manual · time stop
            </label>
          </div>
          <select
            className={styles.select}
            aria-label="Milestone interval"
            value={interval}
            disabled={mode === 'manual'}
            onChange={(event) => setIntervalMs(Number(event.target.value))}
          >
            <option value={1000}>Every 1s</option>
            <option value={2000}>Every 2s</option>
            <option value={3000}>Every 3s</option>
            <option value={5000}>Every 5s</option>
          </select>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={mode === 'manual' || complete}
              onClick={() => setPlaying((value) => !value)}
            >
              {playing ? 'Pause' : snapshot.cursor ? 'Resume' : 'Start'}
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={mode !== 'manual' || busy || complete}
              onClick={() => void advanceOne()}
            >
              Advance 1 milestone
            </button>
            <button
              type="button"
              className={styles.button}
              disabled={snapshot.cursor === 0}
              onClick={restart}
            >
              Restart
            </button>
          </div>
        </div>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.body}>
        <div className={styles.ledger}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.step}>Step / time</th>
                <th>Event</th>
                <th className={styles.storeColumn}>Store</th>
                <th className={styles.impactColumn}>Visible impact</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((milestone) => {
                const events = milestoneEvents(snapshot.events, milestone.id);
                const completed = snapshot.cursor >= milestone.cursor;
                const rowOccurrenceIds = [
                  ...new Set(events.flatMap((event) => event.occurrenceIds)),
                ];
                return (
                  <tr
                    key={milestone.id}
                    className={`${styles.row} ${
                      selectedId === milestone.id ? styles.rowSelected : ''
                    } ${!completed ? styles.rowUpcoming : ''}`}
                    onMouseEnter={() => setPreviewIds(rowOccurrenceIds)}
                    onMouseLeave={() => setPreviewIds([])}
                  >
                    <td className={styles.step}>
                      <span className={styles.stepMarker}>
                        {completed ? '◆' : '◇'}
                      </span>
                      {String(milestone.cursor).padStart(2, '0')}
                      <span className={styles.eventMeta}>
                        {((milestone.cursor * interval) / 1000).toFixed(1)}s
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.eventButton}
                        aria-pressed={selectedId === milestone.id}
                        onClick={() => {
                          setSelectedId(milestone.id);
                          setPinnedOccurrence(null);
                        }}
                      >
                        <span className={styles.eventTitle}>
                          {milestone.title}
                        </span>
                        <span className={styles.eventMeta}>
                          {events.length} causal events · {milestone.id}
                        </span>
                        <span
                          className={`${styles.eventMeta} ${styles.mobileStore}`}
                        >
                          {[
                            ...(milestone.storeSummary ?? []),
                            ...(milestone.visibleSummary ?? []),
                          ].join(' · ')}
                        </span>
                      </button>
                    </td>
                    <td className={styles.storeColumn}>
                      <span className={styles.cellSummary}>
                        {milestone.storeSummary?.slice(0, 2).join(' · ') ?? '—'}
                      </span>
                    </td>
                    <td className={styles.impactColumn}>
                      <span className={styles.cellSummary}>
                        {milestone.visibleSummary?.slice(0, 2).join(' · ') ??
                          '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <aside className={styles.inspector} aria-label="Event inspector">
          <EventInspector
            milestone={selected}
            events={selectedEvents}
            occurrenceIds={occurrenceIds}
            pinnedOccurrence={pinnedOccurrence}
            onPreview={setPreviewIds}
            onPin={setPinnedOccurrence}
            onLocate={locate}
          />
        </aside>
      </div>
      <span className="sr-only" aria-live="polite">
        {selected && snapshot.cursor >= selected.cursor
          ? `${selected.title} completed`
          : ''}
      </span>
    </section>
  );
}
