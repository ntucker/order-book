'use client';

import { useLive, useSuspense } from '@data-client/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';

import {
  accumulate,
  groupLevels,
  imbalance,
  sliceRows,
  type CumulativeLevel,
} from '@/lib/book';
import { formatBps, formatNumber, formatTick } from '@/lib/format';
import { useScenarioOccurrence } from '@/scenarios/client/ScenarioRuntime';
import { useMarketDataEndpoints } from '@/scenarios/resources/ResourceCatalog';

import { useElementSize } from '@/hooks/useElementSize';

import Panel from '../panel/Panel';
import Segmented from '../ui/Segmented';
import Triangle from '../ui/Triangle';
import styles from './OrderBookPanel.module.css';

type ViewMode = 'both' | 'bids' | 'asks';

const GROUP_MULTS = [1, 10, 100, 1000] as const;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

const LevelRow = memo(function LevelRow({
  price,
  qty,
  total,
  depthPct,
  side,
  priceDecimals,
  qtyDecimals,
}: {
  price: number;
  qty: number;
  total: number;
  depthPct: number;
  side: 'bid' | 'ask';
  priceDecimals: number;
  qtyDecimals: number;
}) {
  const prevQty = useRef(qty);
  const [flashQty, setFlashQty] = useState<number | null>(null);
  useEffect(() => {
    if (prevQty.current !== qty) setFlashQty(qty);
    prevQty.current = qty;
  }, [qty]);

  return (
    <div
      className={styles.row}
      role="row"
      style={{ ['--depth' as string]: String(depthPct) }}
    >
      <span
        className={side === 'bid' ? styles.bidDepth : styles.askDepth}
        aria-hidden="true"
      />
      {flashQty !== null ? (
        <span
          key={flashQty}
          className={`${styles.flash} ${side === 'bid' ? styles.bidFlash : styles.askFlash}`}
          aria-hidden="true"
        />
      ) : null}
      <span
        className={`${styles.price} ${side === 'bid' ? styles.bid : styles.ask}`}
        role="cell"
      >
        {formatNumber(price, priceDecimals)}
      </span>
      <span className={styles.qty} role="cell">
        {formatNumber(qty, qtyDecimals)}
      </span>
      <span className={styles.total} role="cell">
        {formatNumber(total, qtyDecimals)}
      </span>
    </div>
  );
});

function ModeIcon({ mode }: { mode: ViewMode }) {
  const cls =
    mode === 'both'
      ? `${styles.icon} ${styles.iconBoth}`
      : mode === 'asks'
        ? `${styles.icon} ${styles.iconAskOnly}`
        : `${styles.icon} ${styles.iconBidOnly}`;
  return (
    <span className={cls} aria-hidden="true">
      <span className={styles.iconAsk} />
      <span className={styles.iconBid} />
    </span>
  );
}

export default function OrderBookPanel({ symbol }: { symbol: string }) {
  const { getOrderBook, getSymbolInfo, getTicker } =
    useMarketDataEndpoints();
  const info = useSuspense(getSymbolInfo, { symbol });
  const book = useLive(getOrderBook, { symbol });
  const ticker = useLive(getTicker, { symbol });
  const [groupMult, setGroupMult] = useState<string>('1');
  const [mode, setMode] = useState<ViewMode>('both');
  const [bodyRef, size] = useElementSize<HTMLDivElement>();
  const midRef = useRef<HTMLSpanElement>(null);
  useScenarioOccurrence(bodyRef, {
    occurrenceId: 'book-panel',
    viewId: 'order-book',
    label: 'Order Book panel',
    entityPaths: [{ key: 'OrderBook', pk: symbol }],
    mobilePane: 'book',
  });
  useScenarioOccurrence(midRef, {
    occurrenceId: 'book-mid-price',
    viewId: 'order-book',
    label: 'Order Book mid price',
    entityPaths: [
      { key: 'OrderBook', pk: symbol },
      { key: 'Ticker', pk: symbol },
    ],
    mobilePane: 'book',
  });

  const tick = info.tickSize * Number(groupMult);
  const rowsPerSide = useMemo(() => {
    const chrome = 24 + 32 + 24;
    const raw =
      size.height > 0
        ? Math.floor(
            (size.height - chrome) / 22 / (mode === 'both' ? 2 : 1),
          )
        : 14;
    return clamp(raw, 6, 30);
  }, [size.height, mode]);

  const view = useMemo(() => {
    const groupedBids = accumulate(groupLevels(book.bids, tick, 'bid'));
    const groupedAsks = accumulate(groupLevels(book.asks, tick, 'ask'));
    const bidRows = sliceRows(groupedBids, rowsPerSide);
    const askRows = sliceRows(groupedAsks, rowsPerSide);
    const shownBids = mode === 'asks' ? [] : bidRows;
    const shownAsks = mode === 'bids' ? [] : askRows;
    const maxTotal = Math.max(
      shownBids.at(-1)?.total ?? 0,
      shownAsks.at(-1)?.total ?? 0,
      1,
    );
    return {
      bids: shownBids,
      asks: shownAsks,
      maxTotal,
      imb: imbalance(shownBids, shownAsks),
    };
  }, [book, tick, rowsPerSide, mode]);

  const askDisplay: (CumulativeLevel | null)[] = [...view.asks].reverse();
  while (mode !== 'bids' && askDisplay.length < rowsPerSide) {
    askDisplay.unshift(null);
  }
  const bidDisplay: (CumulativeLevel | null)[] = [...view.bids];
  while (mode !== 'asks' && bidDisplay.length < rowsPerSide) {
    bidDisplay.push(null);
  }

  const dirClass =
    ticker.direction === 'up'
      ? styles.bid
      : ticker.direction === 'down'
        ? styles.ask
        : '';

  return (
    <Panel
      title="Order Book"
      meta={`${info.baseAsset}/${info.quoteAsset}`}
      controls={
        <>
          <Segmented
            ariaLabel="Price grouping"
            value={groupMult}
            onChange={setGroupMult}
            options={GROUP_MULTS.map((mult) => ({
              value: String(mult),
              label: formatTick(info.tickSize * mult),
            }))}
          />
          <Segmented
            ariaLabel="Book view"
            value={mode}
            onChange={setMode}
            options={(
              [
                ['both', 'Both sides'],
                ['bids', 'Bids only'],
                ['asks', 'Asks only'],
              ] as const
            ).map(([value, label]) => ({
              value,
              label: <ModeIcon mode={value} />,
              ariaLabel: label,
            }))}
          />
        </>
      }
    >
      <div className={styles.body} ref={bodyRef}>
        <div className={styles.columns} aria-hidden="true">
          <span>Price ({info.quoteAsset})</span>
          <span>Size ({info.baseAsset})</span>
          <span>Total ({info.baseAsset})</span>
        </div>
        <div role="table" aria-label={`${symbol} order book`}>
          {mode !== 'bids' ? (
            <div className={styles.rows} role="rowgroup" aria-label="Asks">
              {askDisplay.map((level, i) =>
                level ? (
                  <LevelRow
                    key={`a-${level.price}`}
                    price={level.price}
                    qty={level.qty}
                    total={level.total}
                    depthPct={level.total / view.maxTotal}
                    side="ask"
                    priceDecimals={info.priceDecimals}
                    qtyDecimals={info.qtyDecimals}
                  />
                ) : (
                  <div key={`ae-${i}`} className={styles.empty} />
                ),
              )}
            </div>
          ) : null}
          <div className={styles.spread}>
            <span ref={midRef} className={`${styles.mid} ${dirClass}`}>
              <Triangle direction={ticker.direction} />
              {formatNumber(book.midPrice, info.priceDecimals)}
            </span>
            <span className={styles.spreadMeta}>
              Spread {formatNumber(book.spread, info.priceDecimals)} ·{' '}
              {formatBps(book.spreadBps)}
            </span>
          </div>
          {mode !== 'asks' ? (
            <div className={styles.rows} role="rowgroup" aria-label="Bids">
              {bidDisplay.map((level, i) =>
                level ? (
                  <LevelRow
                    key={`b-${level.price}`}
                    price={level.price}
                    qty={level.qty}
                    total={level.total}
                    depthPct={level.total / view.maxTotal}
                    side="bid"
                    priceDecimals={info.priceDecimals}
                    qtyDecimals={info.qtyDecimals}
                  />
                ) : (
                  <div key={`be-${i}`} className={styles.empty} />
                ),
              )}
            </div>
          ) : null}
        </div>
        <div className={styles.footer}>
          <span className={styles.imb}>B {Math.round(view.imb.bidPct)}%</span>
          <div className={styles.bar} aria-hidden="true">
            <span className={styles.bidBar} style={{ width: `${view.imb.bidPct}%` }} />
            <span className={styles.askBar} style={{ width: `${view.imb.askPct}%` }} />
          </div>
          <span className={styles.imb}>{Math.round(view.imb.askPct)}% A</span>
        </div>
      </div>
    </Panel>
  );
}
