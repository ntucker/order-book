'use client';

import { useLive } from '@data-client/react';
import Link from 'next/link';

import { formatNumber, formatSignedPercent } from '@/lib/format';
import { splitSymbol, WATCHLIST } from '@/lib/symbols';
import { getTicker, getTickers, type Ticker } from '@/resources';

import Panel from '../panel/Panel';
import styles from './Watchlist.module.css';

function symbolsFor(current: string): string[] {
  return (WATCHLIST as readonly string[]).includes(current)
    ? [...WATCHLIST]
    : [current, ...WATCHLIST];
}

type NavProps = {
  onNavigate: (symbol: string) => void;
  pendingSymbol: string | null;
};

function Row({
  ticker,
  current,
  variant,
  onNavigate,
  pendingSymbol,
}: NavProps & {
  ticker: Ticker;
  current: string;
  variant: 'row' | 'chip';
}) {
  const [base, quote] = splitSymbol(ticker.symbol);
  const active = ticker.symbol === current;
  const pending = ticker.symbol === pendingSymbol;
  const selected = active || pending;
  const className =
    variant === 'chip'
      ? (selected ? styles.chipActive : styles.chip)
      : (selected ? styles.active : styles.row);
  const up = ticker.priceChangePercent >= 0;
  const flash =
    ticker.direction === 'up'
      ? styles.flashBid
      : ticker.direction === 'down'
        ? styles.flashAsk
        : undefined;

  return (
    <Link
      href={`/${ticker.symbol}`}
      onNavigate={(e) => {
        e.preventDefault();
        onNavigate(ticker.symbol);
      }}
      aria-current={active ? 'page' : undefined}
      data-pending={pending ? '' : undefined}
      className={className}
    >
      {variant === 'chip' ? (
        <span>
          {base}
          <span className={styles.quote}>/{quote}</span>
        </span>
      ) : (
        <span className={styles.pair}>
          <span className={styles.base}>{base}</span>
          <span className={styles.quote}>/{quote}</span>
        </span>
      )}
      <span className={`${styles.price} ${flash ?? ''}`} key={ticker.direction}>
        {formatNumber(ticker.lastPrice, ticker.lastPrice >= 100 ? 2 : 4)}
      </span>
      <span className={`${styles.pct} ${up ? styles.up : styles.down}`}>
        {formatSignedPercent(ticker.priceChangePercent)}
      </span>
    </Link>
  );
}

export default function Watchlist({
  current,
  variant = 'rail',
  onNavigate,
  pendingSymbol,
}: NavProps & {
  current: string;
  variant?: 'rail' | 'chips';
}) {
  const symbols = symbolsFor(current);
  const watch = useLive(getTickers, { symbols: [...WATCHLIST] });
  const extraNeeded = !(WATCHLIST as readonly string[]).includes(current);
  const extra = useLive(getTicker, extraNeeded ? { symbol: current } : null);

  const bySymbol = new Map(watch.map((ticker) => [ticker.symbol, ticker]));
  if (extra) bySymbol.set(extra.symbol, extra);
  const rows = symbols
    .map((symbol) => bySymbol.get(symbol))
    .filter((ticker): ticker is Ticker => Boolean(ticker));

  if (variant === 'chips') {
    return (
      <nav className={styles.chips} aria-label="Markets">
        {rows.map((ticker) => (
          <Row
            key={ticker.symbol}
            ticker={ticker}
            current={current}
            variant="chip"
            onNavigate={onNavigate}
            pendingSymbol={pendingSymbol}
          />
        ))}
      </nav>
    );
  }

  return (
    <Panel title="Markets">
      <nav className={styles.list} aria-label="Markets">
        {rows.map((ticker) => (
          <Row
            key={ticker.symbol}
            ticker={ticker}
            current={current}
            variant="row"
            onNavigate={onNavigate}
            pendingSymbol={pendingSymbol}
          />
        ))}
      </nav>
    </Panel>
  );
}
