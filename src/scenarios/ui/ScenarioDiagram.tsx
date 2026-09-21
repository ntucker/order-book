import type { CSSProperties } from 'react';

import styles from './ScenarioDiagram.module.css';
import { SCENARIO_DIAGRAM_IDS } from './scenarioDiagramIds';

type CellKind =
  | 'skeleton'
  | 'blank'
  | 'static'
  | 'live'
  | 'reject'
  | 'request'
  | 'idle'
  | 'hidden';

type Spec = CellKind | readonly [CellKind, string];

type BoardSpec = {
  label: string;
  columns: string[];
  rows: { name: string; cells: Spec[] }[];
  phone?: boolean;
};

const MARK: Partial<Record<CellKind, string>> = {
  live: '▲',
  request: '⟳',
  blank: '✗',
  reject: '✗',
};

const BOARDS: Record<(typeof SCENARIO_DIAGRAM_IDS)[number], BoardSpec> = {
  'streamed-reveal': {
    label:
      'Frame first, each panel paints with its own piece, then one ticker write is 100.05 in Header, Watchlist, and Book mid.',
    columns: ['frame', 'fast', 'slow', 'tick'],
    rows: [
      {
        name: 'Header',
        cells: ['skeleton', ['static', '100.01'], ['static', '100.01'], ['live', '100.05']],
      },
      {
        name: 'Watch',
        cells: ['skeleton', ['static', '100.01'], ['static', '100.01'], ['live', '100.05']],
      },
      {
        name: 'Book',
        cells: ['skeleton', 'skeleton', ['static', 'bids'], ['live', '100.05']],
      },
    ],
  },
  'late-server-merge': {
    label:
      'Book #520 then older #499. Visible levels stay #520. Numbers never go backwards.',
    columns: ['#500', '#520', '#499'],
    rows: [
      {
        name: 'Arrives',
        cells: [
          ['static', '#500'],
          ['live', '#520'],
          ['reject', '#499'],
        ],
      },
      {
        name: 'Shown',
        cells: [
          ['static', '#500'],
          ['live', '#520'],
          ['live', '#520'],
        ],
      },
    ],
  },
  'symbol-transition': {
    label:
      'Click ETH: BTC stays visible and live, ETH is pending, then the dashboard swaps at once.',
    columns: ['click ETH', 'held', 'ready'],
    rows: [
      {
        name: 'Watch',
        cells: [
          ['request', 'ETH'],
          ['request', 'ETH'],
          ['live', 'ETH'],
        ],
      },
      {
        name: 'Header',
        cells: [
          ['live', 'BTC 100.05'],
          ['live', 'BTC 100.06'],
          ['live', 'ETH 3210'],
        ],
      },
      {
        name: 'Book',
        cells: [
          ['live', 'BTC'],
          ['live', 'BTC'],
          ['live', 'ETH'],
        ],
      },
    ],
  },
  'readiness-from-records': {
    label:
      'getTickers writes Ticker:BTC. Header paints 100.00 without starting a ticker request.',
    columns: ['list', 'header'],
    rows: [
      {
        name: 'Store',
        cells: [
          ['static', 'Ticker:BTC'],
          ['static', 'Ticker:BTC'],
        ],
      },
      { name: 'Header', cells: ['skeleton', ['static', '100.00']] },
      {
        name: 'ticker',
        cells: [
          ['idle', '0 ⟳'],
          ['reject', '0 ⟳'],
        ],
      },
    ],
  },
  'rapid-book-updates': {
    label:
      'Forward 1.2: #520 shows 100.04 / 100.06, then #540 shows 100.07 / 100.08 and 100.06 is gone.',
    columns: ['#520', '#540'],
    rows: [
      {
        name: 'Inside',
        cells: [
          ['live', '100.04 / 100.06'],
          ['live', '100.07 / 100.08'],
        ],
      },
      {
        name: '100.06',
        cells: [
          ['static', 'shown'],
          ['reject', 'gone'],
        ],
      },
    ],
  },
  'handoff-outcome-a': {
    label:
      'Outcome A: blank until the slowest request, then the entire page arrives at once.',
    columns: ['0.05', '0.6', '1.2'],
    rows: [
      {
        name: 'Frame',
        cells: [
          ['blank', 'blank'],
          ['blank', 'blank'],
          ['static', 'all'],
        ],
      },
      {
        name: 'Watch',
        cells: [
          ['blank', 'blank'],
          ['blank', 'blank'],
          ['static', '100.01'],
        ],
      },
    ],
  },
  'handoff-outcome-b': {
    label:
      'Outcome B: first wave paints and hydrates; book arrives late from an incomplete store.',
    columns: ['0.05', '0.6', '1.2'],
    rows: [
      {
        name: 'Watch',
        cells: ['skeleton', ['static', '100.01'], ['live', '100.01']],
      },
      { name: 'Book', cells: ['skeleton', 'skeleton', ['request', 'late']] },
    ],
  },
  'handoff-outcome-c': {
    label:
      'Outcome C: empty store hands off first. Panels wake and fetch; server HTML is unused.',
    columns: ['0.02', 'wake', '0.6'],
    rows: [
      { name: 'Frame', cells: ['skeleton', 'skeleton', 'skeleton'] },
      {
        name: 'Watch',
        cells: ['skeleton', ['request', 'list'], ['live', '100.01']],
      },
      {
        name: 'Book',
        cells: ['skeleton', ['idle', 'waterfall'], ['request', 'client']],
      },
    ],
  },
  'live-after-hydrate': {
    label:
      'Watchlist is live and clickable at 100.05 while the Book is still a skeleton, then Book arrives without resetting the Header.',
    columns: ['0.6', 'tick', 'book'],
    rows: [
      {
        name: 'Watch',
        cells: [
          ['static', '100.00'],
          ['live', '100.05'],
          ['live', '100.05'],
        ],
      },
      { name: 'Book', cells: ['skeleton', 'skeleton', ['static', 'bids']] },
    ],
  },
  'hidden-pane-subscriptions': {
    label:
      'At 375px Trades is showing and Book is CSS-hidden. A tick still updates the Header. Recorded mount, not unsubscribe-when-off-screen.',
    columns: ['hidden', 'tick'],
    phone: true,
    rows: [
      {
        name: 'Header',
        cells: [
          ['static', '100.00'],
          ['live', '100.05'],
        ],
      },
      {
        name: 'Book',
        cells: [
          ['hidden', 'CSS'],
          ['hidden', 'mounted'],
        ],
      },
    ],
  },
  'route-h': {
    label:
      'Route H: data travels with the panel. Pending Chart stays idle — zero candles request until its piece.',
    columns: ['fast', 'tick', 'piece'],
    rows: [
      {
        name: 'Header',
        cells: [
          ['static', '100.00'],
          ['live', '100.05'],
          ['live', '100.05'],
        ],
      },
      {
        name: 'Chart',
        cells: [
          ['idle', 'idle'],
          ['idle', '0 ⟳'],
          ['static', 'candles'],
        ],
      },
    ],
  },
  'route-w-fetch-now': {
    label:
      'Route W fetch-now: pending panels wake and start book, trades, candles before those snapshots release.',
    columns: ['fast', 'wake', 'piece'],
    rows: [
      {
        name: 'Header',
        cells: [
          ['static', '100.00'],
          ['live', '100.00'],
          ['live', '100.00'],
        ],
      },
      {
        name: 'Book',
        cells: [
          ['idle', 'idle'],
          ['request', 'started'],
          ['static', 'body'],
        ],
      },
    ],
  },
  'symbol-return': {
    label:
      'BTC ticks to 100.05, go ETH, come back. Header is 100.00 from fixtures, not 100.05. New page, new store.',
    columns: ['BTC', 'ETH', 'BTC'],
    rows: [
      {
        name: 'Header',
        cells: [
          ['live', '100.05'],
          ['live', 'ETH'],
          ['static', '100.00'],
        ],
      },
      {
        name: 'Remember',
        cells: [
          ['live', '100.05'],
          ['hidden', 'lost'],
          ['reject', '100.05'],
        ],
      },
    ],
  },
};

function textOf(spec: Spec) {
  return typeof spec === 'string' ? undefined : spec[1];
}

function kindOf(spec: Spec): CellKind {
  return typeof spec === 'string' ? spec : spec[0];
}

function Board({
  columns,
  rows,
  label,
  framed = true,
}: {
  columns: string[];
  rows: BoardSpec['rows'];
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
        {columns.map((column, index) => (
          <span className={styles.time} key={`${column}-${index}`}>
            {column}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div className={styles.row} key={row.name}>
          <span className={styles.label}>{row.name}</span>
          {row.cells.map((spec, index) => {
            const kind = kindOf(spec);
            const mark = MARK[kind];
            return (
              <span
                className={styles.cell}
                data-kind={kind}
                key={`${row.name}-${index}`}
              >
                {kind === 'skeleton' ? (
                  <span aria-hidden="true">░░░░</span>
                ) : (
                  <>
                    {textOf(spec)}
                    {mark ? (
                      <span className={styles.mark} aria-hidden="true">
                        {mark}
                      </span>
                    ) : null}
                  </>
                )}
              </span>
            );
          })}
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

function Phone({ spec }: { spec: BoardSpec }) {
  return (
    <figure
      className={styles.figure}
      aria-label={spec.label}
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
        <Board framed={false} columns={spec.columns} rows={spec.rows} />
      </div>
    </figure>
  );
}

export default function ScenarioDiagram({ id }: { id: string }) {
  const spec = BOARDS[id as keyof typeof BOARDS];
  if (!spec) return null;
  if (spec.phone) return <Phone spec={spec} />;
  return <Board columns={spec.columns} rows={spec.rows} label={spec.label} />;
}
