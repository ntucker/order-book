'use client';

import { useLive, useSuspense } from '@data-client/react';
import { useEffect, useRef } from 'react';

import {
  formatCompact,
  formatNumber,
  formatSignedPercent,
} from '@/lib/format';
import {
  useMarketDataEndpoints,
} from '@/scenarios/resources/ResourceCatalog';
import {
  useScenarioOccurrence,
} from '@/scenarios/client/ScenarioRuntime';

import Triangle from '../ui/Triangle';
import styles from './TickerHeader.module.css';

export default function TickerHeader({ symbol }: { symbol: string }) {
  const { getSymbolInfo, getTicker } = useMarketDataEndpoints();
  const info = useSuspense(getSymbolInfo, { symbol });
  const ticker = useLive(getTicker, { symbol });
  const priceRef = useRef<HTMLDivElement>(null);
  useScenarioOccurrence(priceRef, {
    occurrenceId: 'ticker-header-price',
    entityPaths: [{ key: 'Ticker', pk: symbol }],
  });
  const dirClass =
    ticker.direction === 'up'
      ? styles.bid
      : ticker.direction === 'down'
        ? styles.ask
        : styles.flat;
  const changeClass =
    ticker.priceChange > 0
      ? styles.bid
      : ticker.priceChange < 0
        ? styles.ask
        : undefined;
  const price = formatNumber(ticker.lastPrice, info.priceDecimals);

  useEffect(() => {
    document.title = `${price} ${info.baseAsset}/${info.quoteAsset}`;
  }, [price, info.baseAsset, info.quoteAsset]);

  return (
    <section className={styles.bar} aria-label={`${symbol} ticker`}>
      <div className={styles.pair}>
        <span className={styles.base}>{info.baseAsset}</span>
        <span className={styles.quote}>/{info.quoteAsset}</span>
      </div>
      <div ref={priceRef} className={`${styles.price} ${dirClass}`}>
        <Triangle direction={ticker.direction} />
        {price}
      </div>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.label}>24h Change</span>
          <span className={`${styles.value} ${changeClass ?? ''}`}>
            {formatNumber(ticker.priceChange, info.priceDecimals)} (
            {formatSignedPercent(ticker.priceChangePercent)})
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>24h High</span>
          <span className={styles.value}>
            {formatNumber(ticker.highPrice, info.priceDecimals)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>24h Low</span>
          <span className={styles.value}>
            {formatNumber(ticker.lowPrice, info.priceDecimals)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>24h Volume ({info.baseAsset})</span>
          <span className={styles.value}>{formatCompact(ticker.volume)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.label}>24h Volume ({info.quoteAsset})</span>
          <span className={styles.value}>
            {formatCompact(ticker.quoteVolume)}
          </span>
        </div>
      </div>
    </section>
  );
}
