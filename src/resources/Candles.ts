import { Entity, RestEndpoint } from '@data-client/rest';

import { BINANCE_REST, binanceLive } from './binance';

export const MAX_CANDLES = 500;
export const CANDLE_LIMIT = 300;

export const CANDLE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function parseCandle(raw: unknown): Candle | undefined {
  if (Array.isArray(raw) && raw.length >= 6) {
    const time = Math.floor(Number(raw[0]) / 1000);
    const open = Number(raw[1]);
    const high = Number(raw[2]);
    const low = Number(raw[3]);
    const close = Number(raw[4]);
    const volume = Number(raw[5]);
    if (
      !Number.isFinite(time) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close) ||
      !Number.isFinite(volume)
    ) {
      return undefined;
    }
    return { time, open, high, low, close, volume };
  }
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const time = Number(row.time);
  const open = Number(row.open);
  const high = Number(row.high);
  const low = Number(row.low);
  const close = Number(row.close);
  const volume = Number(row.volume);
  if (
    !Number.isFinite(time) ||
    !Number.isFinite(open) ||
    !Number.isFinite(high) ||
    !Number.isFinite(low) ||
    !Number.isFinite(close) ||
    !Number.isFinite(volume)
  ) {
    return undefined;
  }
  return { time, open, high, low, close, volume };
}

export class Candles extends Entity {
  symbol = '';
  interval: CandleInterval = '1m';
  candles: Candle[] = [];

  pk(): string {
    return `${this.symbol}:${this.interval}`;
  }

  static key = 'Candles';

  static process(
    input: unknown,
    _parent: unknown,
    _key: string | undefined,
    args: readonly { symbol?: string; interval?: string }[],
  ) {
    const shaped = !Array.isArray(input) && input && typeof input === 'object'
      ? (input as { symbol?: string; interval?: string; candles?: unknown })
      : undefined;
    const symbol = String(shaped?.symbol ?? args[0]?.symbol ?? '').toUpperCase();
    const interval = String(
      shaped?.interval ?? args[0]?.interval ?? '1m',
    ) as CandleInterval;
    if (!symbol) throw new Error('Invalid kline payload');
    const raw = Array.isArray(input)
      ? input
      : Array.isArray(shaped?.candles)
        ? shaped.candles
        : [];
    const candles = raw
      .flatMap((row) => {
        const parsed = parseCandle(row);
        return parsed ? [parsed] : [];
      })
      .slice(-MAX_CANDLES);
    return { symbol, interval, candles };
  }
}

export const getCandles = new RestEndpoint({
  urlPrefix: BINANCE_REST,
  path: '/klines',
  searchParams: {} as { symbol: string; interval: CandleInterval },
  schema: Candles,
  streams: ({ symbol, interval }: { symbol: string; interval: string }) => [
    `${symbol.toLowerCase()}@kline_${interval}`,
  ],
  searchToString(searchParams: Record<string, unknown>) {
    return new URLSearchParams({
      symbol: String(searchParams.symbol ?? ''),
      interval: String(searchParams.interval ?? '1m'),
      limit: String(CANDLE_LIMIT),
    }).toString();
  },
  ...binanceLive,
});
