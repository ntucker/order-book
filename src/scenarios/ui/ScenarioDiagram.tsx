import type { CSSProperties, ReactNode } from 'react';

import styles from './ScenarioDiagram.module.css';
import { SCENARIO_DIAGRAM_IDS } from './scenarioDiagramIds';

type CellKind =
  | 'empty'
  | 'skeleton'
  | 'blank'
  | 'static'
  | 'live'
  | 'reject'
  | 'request'
  | 'idle'
  | 'hidden';

type Cell = { kind: CellKind; text?: string; mark?: string };

const MARK: Partial<Record<CellKind, string>> = {
  live: '▲',
  request: '⟳',
  blank: '✗',
  reject: '✗',
};

function Board({
  columns,
  rows,
  label,
  framed = true,
}: {
  columns: string[];
  rows: { name: string; cells: Cell[] }[];
  label?: string;
  framed?: boolean;
}) {
  const body = (
    <div
      className={styles.board}
      style={{ '--cols': columns.length } as CSSProperties}
    >
      <div className={styles.head}>
        <span />
        {columns.map((column) => (
          <span className={styles.time} key={column}>
            {column}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div className={styles.row} key={row.name}>
          <span className={styles.label}>{row.name}</span>
          {row.cells.map((cell, index) => (
            <span
              className={styles.cell}
              data-kind={cell.kind}
              key={`${row.name}-${index}`}
            >
              {cell.kind === 'skeleton' ? (
                <span aria-hidden="true">░░░░</span>
              ) : (
                <>
                  {cell.text}
                  {cell.mark || MARK[cell.kind] ? (
                    <span className={styles.mark} aria-hidden="true">
                      {cell.mark ?? MARK[cell.kind]}
                    </span>
                  ) : null}
                </>
              )}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
  if (!framed) return body;
  return (
    <figure
      className={styles.figure}
      aria-label={label}
      data-scenario-diagram=""
    >
      {body}
    </figure>
  );
}

function StreamedReveal() {
  return (
    <Board
      label="Frame first, each panel paints with its own piece, then one ticker write is 100.05 in Header, Watchlist, and Book mid."
      columns={['frame', 'fast', 'slow', 'tick']}
      rows={[
        {
          name: 'Header',
          cells: [
            { kind: 'skeleton' },
            { kind: 'static', text: '100.01' },
            { kind: 'static', text: '100.01' },
            { kind: 'live', text: '100.05' },
          ],
        },
        {
          name: 'Watch',
          cells: [
            { kind: 'skeleton' },
            { kind: 'static', text: '100.01' },
            { kind: 'static', text: '100.01' },
            { kind: 'live', text: '100.05' },
          ],
        },
        {
          name: 'Book',
          cells: [
            { kind: 'skeleton' },
            { kind: 'skeleton' },
            { kind: 'static', text: 'bids' },
            { kind: 'live', text: '100.05' },
          ],
        },
      ]}
    />
  );
}

function LateServerMerge() {
  return (
    <Board
      label="Book #520 then older #499. Visible levels stay #520. Numbers never go backwards."
      columns={['#500', '#520', '#499']}
      rows={[
        {
          name: 'Arrives',
          cells: [
            { kind: 'static', text: '#500' },
            { kind: 'live', text: '#520' },
            { kind: 'reject', text: '#499' },
          ],
        },
        {
          name: 'Shown',
          cells: [
            { kind: 'static', text: '#500' },
            { kind: 'live', text: '#520' },
            { kind: 'live', text: '#520' },
          ],
        },
      ]}
    />
  );
}

function SymbolTransition() {
  return (
    <Board
      label="Click ETH: BTC stays visible and live, ETH is pending, then the dashboard swaps at once."
      columns={['click ETH', 'held', 'ready']}
      rows={[
        {
          name: 'Watch',
          cells: [
            { kind: 'request', text: 'ETH' },
            { kind: 'request', text: 'ETH' },
            { kind: 'live', text: 'ETH' },
          ],
        },
        {
          name: 'Header',
          cells: [
            { kind: 'live', text: 'BTC 100.05' },
            { kind: 'live', text: 'BTC 100.06' },
            { kind: 'live', text: 'ETH 3210' },
          ],
        },
        {
          name: 'Book',
          cells: [
            { kind: 'live', text: 'BTC' },
            { kind: 'live', text: 'BTC' },
            { kind: 'live', text: 'ETH' },
          ],
        },
      ]}
    />
  );
}

function ReadinessFromRecords() {
  return (
    <Board
      label="getTickers writes Ticker:BTC. Header paints 100.00 without starting a ticker request."
      columns={['list', 'header']}
      rows={[
        {
          name: 'Store',
          cells: [
            { kind: 'static', text: 'Ticker:BTC' },
            { kind: 'static', text: 'Ticker:BTC' },
          ],
        },
        {
          name: 'Header',
          cells: [
            { kind: 'skeleton' },
            { kind: 'static', text: '100.00' },
          ],
        },
        {
          name: 'ticker',
          cells: [
            { kind: 'idle', text: '0 ⟳' },
            { kind: 'reject', text: '0 ⟳' },
          ],
        },
      ]}
    />
  );
}

function RapidBookUpdates() {
  return (
    <Board
      label="Forward 1.2: #520 shows 100.04 / 100.06, then #540 shows 100.07 / 100.08 and 100.06 is gone."
      columns={['#520', '#540']}
      rows={[
        {
          name: 'Inside',
          cells: [
            { kind: 'live', text: '100.04 / 100.06' },
            { kind: 'live', text: '100.07 / 100.08' },
          ],
        },
        {
          name: '100.06',
          cells: [
            { kind: 'static', text: 'shown' },
            { kind: 'reject', text: 'gone' },
          ],
        },
      ]}
    />
  );
}

function HandoffOutcomeA() {
  return (
    <Board
      label="Outcome A: blank until the slowest request, then the entire page arrives at once."
      columns={['0.05', '0.6', '1.2']}
      rows={[
        {
          name: 'Frame',
          cells: [
            { kind: 'blank', text: 'blank' },
            { kind: 'blank', text: 'blank' },
            { kind: 'static', text: 'all' },
          ],
        },
        {
          name: 'Watch',
          cells: [
            { kind: 'blank', text: 'blank' },
            { kind: 'blank', text: 'blank' },
            { kind: 'static', text: '100.01' },
          ],
        },
      ]}
    />
  );
}

function HandoffOutcomeB() {
  return (
    <Board
      label="Outcome B: first wave paints and hydrates; book arrives late from an incomplete store."
      columns={['0.05', '0.6', '1.2']}
      rows={[
        {
          name: 'Watch',
          cells: [
            { kind: 'skeleton' },
            { kind: 'static', text: '100.01' },
            { kind: 'live', text: '100.01' },
          ],
        },
        {
          name: 'Book',
          cells: [
            { kind: 'skeleton' },
            { kind: 'skeleton' },
            { kind: 'request', text: 'late' },
          ],
        },
      ]}
    />
  );
}

function HandoffOutcomeC() {
  return (
    <Board
      label="Outcome C: empty store hands off first. Panels wake and fetch; server HTML is unused."
      columns={['0.02', 'wake', '0.6']}
      rows={[
        {
          name: 'Frame',
          cells: [
            { kind: 'skeleton' },
            { kind: 'skeleton' },
            { kind: 'skeleton' },
          ],
        },
        {
          name: 'Watch',
          cells: [
            { kind: 'skeleton' },
            { kind: 'request', text: 'list' },
            { kind: 'live', text: '100.01' },
          ],
        },
        {
          name: 'Book',
          cells: [
            { kind: 'skeleton' },
            { kind: 'idle', text: 'waterfall' },
            { kind: 'request', text: 'client' },
          ],
        },
      ]}
    />
  );
}

function LiveAfterHydrate() {
  return (
    <Board
      label="Watchlist is live and clickable at 100.05 while the Book is still a skeleton, then Book arrives without resetting the Header."
      columns={['0.6', 'tick', 'book']}
      rows={[
        {
          name: 'Watch',
          cells: [
            { kind: 'static', text: '100.00' },
            { kind: 'live', text: '100.05' },
            { kind: 'live', text: '100.05' },
          ],
        },
        {
          name: 'Book',
          cells: [
            { kind: 'skeleton' },
            { kind: 'skeleton' },
            { kind: 'static', text: 'bids' },
          ],
        },
      ]}
    />
  );
}

function HiddenPaneSubscriptions() {
  return (
    <figure
      className={styles.figure}
      aria-label="At 375px Trades is showing and Book is CSS-hidden. A tick still updates the Header. Recorded mount, not unsubscribe-when-off-screen."
      data-scenario-diagram=""
    >
      <div className={styles.phone}>
        <div className={styles.device} aria-hidden="true">
          <span className={styles.notch} />
          <div className={styles.pane} data-on="true">
            Trades
          </div>
          <div className={styles.pane}>Book</div>
          <div className={styles.switcher}>
            <span>Book</span>
            <span>Chart</span>
            <span data-on="true">Trades</span>
          </div>
        </div>
        <Board
          framed={false}
          columns={['hidden', 'tick']}
          rows={[
            {
              name: 'Header',
              cells: [
                { kind: 'static', text: '100.00' },
                { kind: 'live', text: '100.05' },
              ],
            },
            {
              name: 'Book',
              cells: [
                { kind: 'hidden', text: 'CSS' },
                { kind: 'hidden', text: 'mounted' },
              ],
            },
          ]}
        />
      </div>
    </figure>
  );
}

function RouteH() {
  return (
    <Board
      label="Route H: data travels with the panel. Pending Chart stays idle — zero candles request until its piece."
      columns={['fast', 'tick', 'piece']}
      rows={[
        {
          name: 'Header',
          cells: [
            { kind: 'static', text: '100.00' },
            { kind: 'live', text: '100.05' },
            { kind: 'live', text: '100.05' },
          ],
        },
        {
          name: 'Chart',
          cells: [
            { kind: 'idle', text: 'idle' },
            { kind: 'idle', text: '0 ⟳' },
            { kind: 'static', text: 'candles' },
          ],
        },
      ]}
    />
  );
}

function RouteWFetchNow() {
  return (
    <Board
      label="Route W fetch-now: pending panels wake and start book, trades, candles before those snapshots release."
      columns={['fast', 'wake', 'piece']}
      rows={[
        {
          name: 'Header',
          cells: [
            { kind: 'static', text: '100.00' },
            { kind: 'live', text: '100.00' },
            { kind: 'live', text: '100.00' },
          ],
        },
        {
          name: 'Book',
          cells: [
            { kind: 'idle', text: 'idle' },
            { kind: 'request', text: 'started' },
            { kind: 'static', text: 'body' },
          ],
        },
      ]}
    />
  );
}

function SymbolReturn() {
  return (
    <Board
      label="BTC ticks to 100.05, go ETH, come back. Header is 100.00 from fixtures, not 100.05. New page, new store."
      columns={['BTC', 'ETH', 'BTC']}
      rows={[
        {
          name: 'Header',
          cells: [
            { kind: 'live', text: '100.05' },
            { kind: 'live', text: 'ETH' },
            { kind: 'static', text: '100.00' },
          ],
        },
        {
          name: 'Remember',
          cells: [
            { kind: 'live', text: '100.05' },
            { kind: 'hidden', text: 'lost' },
            { kind: 'reject', text: '100.05' },
          ],
        },
      ]}
    />
  );
}

const DIAGRAMS: Record<(typeof SCENARIO_DIAGRAM_IDS)[number], () => ReactNode> = {
  'streamed-reveal': StreamedReveal,
  'late-server-merge': LateServerMerge,
  'symbol-transition': SymbolTransition,
  'readiness-from-records': ReadinessFromRecords,
  'rapid-book-updates': RapidBookUpdates,
  'handoff-outcome-a': HandoffOutcomeA,
  'handoff-outcome-b': HandoffOutcomeB,
  'handoff-outcome-c': HandoffOutcomeC,
  'live-after-hydrate': LiveAfterHydrate,
  'hidden-pane-subscriptions': HiddenPaneSubscriptions,
  'route-h': RouteH,
  'route-w-fetch-now': RouteWFetchNow,
  'symbol-return': SymbolReturn,
};

export { SCENARIO_DIAGRAM_IDS };

export default function ScenarioDiagram({ id }: { id: string }) {
  const Diagram = DIAGRAMS[id];
  if (!Diagram) return null;
  return <Diagram />;
}
