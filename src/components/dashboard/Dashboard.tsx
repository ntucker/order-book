'use client';

import { AsyncBoundary } from '@data-client/react';
import { useRouter } from 'next/navigation';
import {
  useOptimistic,
  useState,
  useTransition,
  type ReactNode,
} from 'react';

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
  kind,
  title,
  children,
}: {
  id: string;
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
      {children}
    </AsyncBoundary>
  );
}

export default function Dashboard({ symbol }: { symbol: string }) {
  const [pane, setPane] = useState<MobilePane>('book');
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingSymbol, setPendingSymbol] = useOptimistic<string | null>(null);

  const navigate = (next: string) => {
    if (next === symbol) return;
    startTransition(() => {
      setPendingSymbol(next);
      router.push(`/${next}`);
    });
  };

  const book = (
    <Bound id={`${symbol}-book`} kind="book" title="Order Book">
      <OrderBookPanel symbol={symbol} />
    </Bound>
  );
  const chart = (
    <Bound id={`${symbol}-chart`} kind="chart" title="Chart">
      <CandleChartPanel symbol={symbol} />
    </Bound>
  );
  const depth = (
    <Bound id={`${symbol}-depth`} kind="chart" title="Depth">
      <DepthChart symbol={symbol} />
    </Bound>
  );
  const trades = (
    <Bound id={`${symbol}-trades`} kind="trades" title="Trades">
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
        <Bound id={`${symbol}-watch`} kind="watch" title="Markets">
          <Watchlist
            current={symbol}
            onNavigate={navigate}
            pendingSymbol={pendingSymbol}
          />
        </Bound>
      </div>
      <div className={styles.chips}>
        <Bound id={`${symbol}-chips`} kind="watch" title="Markets">
          <Watchlist
            current={symbol}
            variant="chips"
            onNavigate={navigate}
            pendingSymbol={pendingSymbol}
          />
        </Bound>
      </div>
      <div className={styles.ticker}>
        <Bound id={`${symbol}-ticker`} kind="ticker" title="Ticker">
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
