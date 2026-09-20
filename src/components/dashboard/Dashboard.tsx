'use client';

import { AsyncBoundary } from '@data-client/react';
import { useRouter } from 'next/navigation';
import {
  useCallback,
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

import {
  ScenarioPanelGate,
  useScenarioNavigation,
} from '@/scenarios/client/ScenarioRuntime';

import DepthChart from '../book/DepthChart';
import OrderBookPanel from '../book/OrderBookPanel';
import CandleChartPanel from '../chart/CandleChartPanel';
import PanelError from '../panel/PanelError';
import PanelSkeleton from '../panel/PanelSkeleton';
import TickerHeader from '../ticker/TickerHeader';
import TradesPanel from '../trades/TradesPanel';
import Segmented from '../ui/Segmented';
import Watchlist from '../watchlist/Watchlist';
import styles from './Dashboard.module.css';

type MobilePane = 'book' | 'chart' | 'trades';

function Bound({
  id,
  panelId,
  kind,
  title,
  children,
}: {
  id: string;
  panelId: string;
  kind: 'book' | 'trades' | 'chart' | 'ticker' | 'watch';
  title: string;
  children: ReactNode;
}) {
  return (
    <AsyncBoundary
      key={id}
      fallback={<PanelSkeleton kind={kind} title={title} />}
      errorComponent={PanelError}
    >
      <ScenarioPanelGate panelId={panelId} />
      {children}
    </AsyncBoundary>
  );
}

export default function Dashboard({
  symbol,
  scenarioPath,
}: {
  symbol: string;
  scenarioPath?: { scenarioId: string; runId: string };
}) {
  const [pane, setPane] = useState<MobilePane>('book');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingSymbol, setPendingSymbol] = useOptimistic<string | null>(null);
  const scenarioBase = scenarioPath
    ? `/scenarios/${scenarioPath.scenarioId}/${scenarioPath.runId}`
    : '';
  const hrefForSymbol = useCallback(
    (next: string) => (scenarioBase ? `${scenarioBase}/${next}` : `/${next}`),
    [scenarioBase],
  );

  const navigate = useCallback(
    (next: string) => {
      if (next === symbol) return;
      startTransition(() => {
        setPendingSymbol(next);
        const query = scenarioPath ? window.location.search : '';
        router.push(`${hrefForSymbol(next)}${query}`);
      });
    },
    [hrefForSymbol, router, scenarioPath, setPendingSymbol, symbol],
  );
  useScenarioNavigation(navigate);

  const book = (
    <Bound id={`${symbol}-book`} panelId="book" kind="book" title="Order Book">
      <OrderBookPanel symbol={symbol} />
    </Bound>
  );
  const chart = (
    <Bound id={`${symbol}-chart`} panelId="chart" kind="chart" title="Chart">
      <CandleChartPanel symbol={symbol} />
    </Bound>
  );
  const depth = (
    <Bound id={`${symbol}-depth`} panelId="depth" kind="chart" title="Depth">
      <DepthChart symbol={symbol} />
    </Bound>
  );
  const trades = (
    <Bound id={`${symbol}-trades`} panelId="trades" kind="trades" title="Trades">
      <TradesPanel symbol={symbol} />
    </Bound>
  );

  return (
    <div
      className={styles.grid}
      data-pending={pendingSymbol ? '' : undefined}
      aria-busy={Boolean(pendingSymbol)}
    >
      <div className={styles.watch}>
        <Bound
          id={`${symbol}-watch`}
          panelId="watch"
          kind="watch"
          title="Markets"
        >
          <Watchlist
            current={symbol}
            onNavigate={navigate}
            pendingSymbol={pendingSymbol}
            hrefForSymbol={hrefForSymbol}
          />
        </Bound>
      </div>
      <div className={styles.chips}>
        <Bound
          id={`${symbol}-chips`}
          panelId="watch"
          kind="watch"
          title="Markets"
        >
          <Watchlist
            current={symbol}
            variant="chips"
            onNavigate={navigate}
            pendingSymbol={pendingSymbol}
            hrefForSymbol={hrefForSymbol}
          />
        </Bound>
      </div>
      <div className={styles.ticker}>
        <Bound
          id={`${symbol}-ticker`}
          panelId="ticker"
          kind="ticker"
          title="Ticker"
        >
          <TickerHeader symbol={symbol} />
        </Bound>
      </div>
      <div className={`${styles.book} ${pane === 'book' ? styles.showBook : ''}`}>
        {book}
      </div>
      <div
        className={`${styles.center} ${pane === 'chart' ? styles.showChart : ''}`}
      >
        <div className={styles.chart}>{chart}</div>
        <div className={styles.depth}>{depth}</div>
      </div>
      <div
        className={`${styles.trades} ${pane === 'trades' ? styles.showTrades : ''}`}
      >
        {trades}
      </div>
      <div className={styles.switcher}>
        <Segmented
          ariaLabel="Panel"
          value={pane}
          onChange={setPane}
          options={[
            { value: 'book', label: 'Book' },
            { value: 'chart', label: 'Chart' },
            { value: 'trades', label: 'Trades' },
          ]}
        />
      </div>
    </div>
  );
}
