import { Entity, RestEndpoint } from '@data-client/rest';

import { BINANCE_REST, binanceLive } from './binance';

export type TickerDirection = 'up' | 'down' | 'flat';

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class Ticker extends Entity {
  symbol = '';
  lastPrice = 0;
  openPrice = 0;
  highPrice = 0;
  lowPrice = 0;
  volume = 0;
  quoteVolume = 0;
  direction: TickerDirection = 'flat';

  pk(): string {
    return this.symbol;
  }

  static key = 'Ticker';

  get priceChange(): number {
    return this.lastPrice - this.openPrice;
  }

  get priceChangePercent(): number {
    if (this.openPrice === 0) return 0;
    return (this.priceChange / this.openPrice) * 100;
  }

  static schema = {
    lastPrice: num,
    openPrice: num,
    highPrice: num,
    lowPrice: num,
    volume: num,
    quoteVolume: num,
  };

  static merge(existing: Ticker, incoming: Ticker) {
    const incomingPrice = num(incoming.lastPrice);
    const existingPrice = num(existing.lastPrice);
    const direction: TickerDirection =
      incomingPrice > existingPrice
        ? 'up'
        : incomingPrice < existingPrice
          ? 'down'
          : existing.direction;
    return { ...incoming, direction };
  }

  static process(
    input: Record<string, unknown>,
    _parent: unknown,
    _key: string | undefined,
    args: readonly { symbol?: string }[],
  ) {
    const symbol = String(
      input.s ?? input.symbol ?? args[0]?.symbol ?? '',
    ).toUpperCase();
    if (!symbol) throw new Error('Invalid ticker payload');
    return {
      symbol,
      lastPrice: input.c ?? input.lastPrice ?? 0,
      openPrice: input.o ?? input.openPrice ?? 0,
      highPrice: input.h ?? input.highPrice ?? 0,
      lowPrice: input.l ?? input.lowPrice ?? 0,
      volume: input.v ?? input.volume ?? 0,
      quoteVolume: input.q ?? input.quoteVolume ?? 0,
      direction: (input.direction as TickerDirection | undefined) ?? 'flat',
    };
  }
}

export const getTicker = new RestEndpoint({
  urlPrefix: BINANCE_REST,
  path: '/ticker/24hr',
  searchParams: {} as { symbol: string },
  schema: Ticker,
  streams: ({ symbol }: { symbol: string }) => [
    `${symbol.toLowerCase()}@miniTicker`,
  ],
  searchToString(searchParams: Record<string, unknown>) {
    return new URLSearchParams({
      symbol: String(searchParams.symbol ?? ''),
    }).toString();
  },
  ...binanceLive,
});

export const getTickers = new RestEndpoint({
  urlPrefix: BINANCE_REST,
  path: '/ticker/24hr',
  searchParams: {} as { symbols: readonly string[] },
  schema: [Ticker],
  streams: ({ symbols }: { symbols: readonly string[] }) =>
    (symbols ?? []).map((symbol) => `${symbol.toLowerCase()}@miniTicker`),
  searchToString(searchParams: Record<string, unknown>) {
    const symbols = searchParams.symbols;
    return new URLSearchParams({
      symbols: JSON.stringify(Array.isArray(symbols) ? symbols : []),
    }).toString();
  },
  ...binanceLive,
});
