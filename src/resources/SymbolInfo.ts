import { Entity, RestEndpoint } from '@data-client/rest';

import { decimalsFromStep } from '@/lib/format';

import {
  BINANCE_REST,
  binanceFetchResponse,
  binanceGetInit,
  RATE_LIMIT_ERROR_EXPIRY,
} from './binance';

interface ExchangeFilter {
  filterType: string;
  tickSize?: string;
  stepSize?: string;
}

interface ExchangeSymbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: string;
  filters: ExchangeFilter[];
}

function deserializeDecimals(value: unknown): number {
  return typeof value === 'number' ? value : decimalsFromStep(String(value));
}

export class SymbolInfo extends Entity {
  symbol = '';
  baseAsset = '';
  quoteAsset = '';
  tickSize = 0.01;
  stepSize = 0.00001;
  priceDecimals = 2;
  qtyDecimals = 5;

  pk(): string {
    return this.symbol;
  }

  static key = 'SymbolInfo';

  static schema = {
    tickSize: Number,
    stepSize: Number,
    priceDecimals: deserializeDecimals,
    qtyDecimals: deserializeDecimals,
  };

  static process(
    input: { symbols?: ExchangeSymbol[] } | Record<string, unknown>,
    _parent: unknown,
    _key: string | undefined,
    args: readonly { symbol?: string }[],
  ) {
    if (
      input &&
      typeof input === 'object' &&
      'baseAsset' in input &&
      'priceDecimals' in input
    ) {
      return input;
    }
    const row = (input as { symbols?: ExchangeSymbol[] }).symbols?.[0];
    const symbol = String(row?.symbol ?? args[0]?.symbol ?? '').toUpperCase();
    const tickRaw = row?.filters.find((f) => f.filterType === 'PRICE_FILTER')
      ?.tickSize;
    const stepRaw = row?.filters.find((f) => f.filterType === 'LOT_SIZE')
      ?.stepSize;
    const tickSize = Number(tickRaw);
    const stepSize = Number(stepRaw);
    if (
      !row ||
      row.status !== 'TRADING' ||
      !symbol ||
      !row.baseAsset ||
      !row.quoteAsset ||
      !tickRaw ||
      !stepRaw ||
      !Number.isFinite(tickSize) ||
      tickSize <= 0 ||
      !Number.isFinite(stepSize) ||
      stepSize <= 0
    ) {
      throw new Error('Unknown or unlisted symbol');
    }
    return {
      symbol,
      baseAsset: row.baseAsset,
      quoteAsset: row.quoteAsset,
      tickSize: tickRaw,
      stepSize: stepRaw,
      priceDecimals: tickRaw,
      qtyDecimals: stepRaw,
    };
  }
}

export const getSymbolInfo = new RestEndpoint({
  urlPrefix: BINANCE_REST,
  path: '/exchangeInfo',
  searchParams: {} as { symbol: string },
  schema: SymbolInfo,
  dataExpiryLength: 60 * 60 * 1000,
  errorExpiryLength: RATE_LIMIT_ERROR_EXPIRY,
  searchToString(searchParams: Record<string, unknown>) {
    return new URLSearchParams({
      symbol: String(searchParams.symbol ?? '').toUpperCase(),
    }).toString();
  },
  getRequestInit: binanceGetInit,
  fetchResponse: binanceFetchResponse,
});
