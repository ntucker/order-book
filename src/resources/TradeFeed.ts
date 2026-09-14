import { Entity, RestEndpoint } from '@data-client/rest';

import { BINANCE_REST, binanceLive } from './binance';

export const MAX_TRADES = 50;

export interface Trade {
  id: number;
  price: number;
  qty: number;
  time: number;
  isBuyerMaker: boolean;
}

function parseTrade(raw: unknown): Trade | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const row = raw as Record<string, unknown>;
  const id = Number(row.id ?? row.a);
  const price = Number(row.price ?? row.p);
  const qty = Number(row.qty ?? row.q);
  const time = Number(row.time ?? row.T);
  const isBuyerMaker = Boolean(row.isBuyerMaker ?? row.m);
  if (
    !Number.isFinite(id) ||
    !Number.isFinite(price) ||
    !Number.isFinite(qty) ||
    !Number.isFinite(time)
  ) {
    return undefined;
  }
  return { id, price, qty, time, isBuyerMaker };
}

export class TradeFeed extends Entity {
  symbol = '';
  trades: Trade[] = [];

  pk(): string {
    return this.symbol;
  }

  static key = 'TradeFeed';

  static process(
    input: unknown,
    _parent: unknown,
    _key: string | undefined,
    args: readonly { symbol?: string }[],
  ) {
    const shaped = !Array.isArray(input) && input && typeof input === 'object'
      ? (input as { symbol?: string; trades?: unknown })
      : undefined;
    const symbol = String(shaped?.symbol ?? args[0]?.symbol ?? '').toUpperCase();
    if (!symbol) throw new Error('Invalid trade feed payload');
    const raw = Array.isArray(input)
      ? input
      : Array.isArray(shaped?.trades)
        ? shaped.trades
        : [];
    const trades = raw
      .flatMap((row) => {
        const parsed = parseTrade(row);
        return parsed ? [parsed] : [];
      })
      .sort((a, b) => b.time - a.time || b.id - a.id)
      .slice(0, MAX_TRADES);
    return { symbol, trades };
  }
}

export const getTrades = new RestEndpoint({
  urlPrefix: BINANCE_REST,
  path: '/aggTrades',
  searchParams: {} as { symbol: string },
  schema: TradeFeed,
  streams: ({ symbol }: { symbol: string }) => [
    `${symbol.toLowerCase()}@aggTrade`,
  ],
  searchToString(searchParams: Record<string, unknown>) {
    return new URLSearchParams({
      symbol: String(searchParams.symbol ?? ''),
      limit: String(MAX_TRADES),
    }).toString();
  },
  ...binanceLive,
});
