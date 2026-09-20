'use client';

import { useLive, useSuspense } from '@data-client/react';
import { memo, useEffect, useRef, useState } from 'react';

import { useElementSize } from '@/hooks/useElementSize';
import { formatNumber, formatTime } from '@/lib/format';
import { type Trade } from '@/resources';
import { useScenarioOccurrence } from '@/scenarios/client/ScenarioRuntime';
import { useMarketDataEndpoints } from '@/scenarios/resources/ResourceCatalog';

import Panel from '../panel/Panel';
import styles from './TradesPanel.module.css';

const TradeRow = memo(function TradeRow({
  trade,
  priceDecimals,
  qtyDecimals,
  fresh,
  large,
}: {
  trade: Trade;
  priceDecimals: number;
  qtyDecimals: number;
  fresh: boolean;
  large: boolean;
}) {
  const buy = !trade.isBuyerMaker;
  return (
    <div
      className={`${styles.row} ${fresh ? styles.fresh : ''}`}
      role="row"
    >
      <span
        className={`${buy ? styles.bid : styles.ask} ${large ? styles.large : ''}`}
        role="cell"
      >
        {formatNumber(trade.price, priceDecimals)}
      </span>
      <span className={styles.qty} role="cell">
        {formatNumber(trade.qty, qtyDecimals)}
      </span>
      <span className={styles.time} role="cell">
        {formatTime(trade.time)}
      </span>
    </div>
  );
});

export default function TradesPanel({ symbol }: { symbol: string }) {
  const { getSymbolInfo, getTrades } = useMarketDataEndpoints();
  const info = useSuspense(getSymbolInfo, { symbol });
  const feed = useLive(getTrades, { symbol });
  const [bodyRef, size] = useElementSize<HTMLDivElement>();
  useScenarioOccurrence(bodyRef, {
    occurrenceId: 'trades-panel',
    entityPaths: [{ key: 'TradeFeed', pk: symbol }],
  });
  const seen = useRef(new Set<number>());
  const primed = useRef(false);
  const [freshIds, setFreshIds] = useState<Set<number>>(() => new Set());

  const limit = Math.max(1, Math.floor((size.height - 24) / 22));
  const trades = feed.trades.slice(0, limit);
  const qtys = [...trades].map((t) => t.qty).sort((a, b) => a - b);
  const p90 = qtys[Math.floor(qtys.length * 0.9)] ?? Infinity;

  useEffect(() => {
    const list = feed.trades;
    if (!primed.current) {
      for (const trade of list) seen.current.add(trade.id);
      primed.current = true;
      return;
    }
    const next = new Set<number>();
    for (const trade of list) {
      if (!seen.current.has(trade.id)) next.add(trade.id);
      seen.current.add(trade.id);
    }
    setFreshIds((prev) =>
      next.size === 0 && prev.size === 0 ? prev : next,
    );
  }, [feed.trades]);

  return (
    <Panel title="Trades">
      <div className={styles.body} ref={bodyRef}>
        <div className={styles.columns} aria-hidden="true">
          <span>Price ({info.quoteAsset})</span>
          <span>Size ({info.baseAsset})</span>
          <span>Time</span>
        </div>
        <div role="table" aria-label={`${symbol} recent trades`}>
          {trades.map((trade) => (
            <TradeRow
              key={trade.id}
              trade={trade}
              priceDecimals={info.priceDecimals}
              qtyDecimals={info.qtyDecimals}
              fresh={freshIds.has(trade.id)}
              large={trade.qty >= p90}
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}
