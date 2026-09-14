import type { Controller } from '@data-client/react';

import { Candles, MAX_CANDLES, type Candle, type CandleInterval } from './Candles';
import { LocalBookSync } from './LocalBookSync';
import { Ticker } from './Ticker';
import { MAX_TRADES, TradeFeed, type Trade } from './TradeFeed';

export interface StreamHandler {
  onMessage(
    ctrl: Controller,
    symbol: string,
    channel: string,
    data: unknown,
  ): void;
  onSubscribe?(ctrl: Controller, symbol: string, channel: string): void;
  onUnsubscribe?(ctrl: Controller, symbol: string, channel: string): void;
  resyncAll?(): void;
}

const tradeBuffers = new Map<string, Trade[]>();
let tradeFlush: ReturnType<typeof setInterval> | undefined;
let tradeCtrl: Controller | undefined;

function parseIncomingTrade(data: unknown): Trade | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const row = data as Record<string, unknown>;
  const id = Number(row.a);
  const price = Number(row.p);
  const qty = Number(row.q);
  const time = Number(row.T);
  if (
    !Number.isFinite(id) ||
    !Number.isFinite(price) ||
    !Number.isFinite(qty) ||
    !Number.isFinite(time)
  ) {
    return undefined;
  }
  return { id, price, qty, time, isBuyerMaker: Boolean(row.m) };
}

function flushTrades() {
  if (!tradeCtrl) return;
  for (const [symbol, batch] of tradeBuffers) {
    if (!batch.length) continue;
    tradeBuffers.set(symbol, []);
    const newestFirst = batch.reverse();
    tradeCtrl.set(TradeFeed, { symbol }, (prev) => ({
      symbol,
      trades: [...newestFirst, ...prev.trades].slice(0, MAX_TRADES),
    }));
  }
}

function startTradeFlush(ctrl: Controller) {
  tradeCtrl = ctrl;
  if (!tradeFlush) tradeFlush = setInterval(flushTrades, 100);
}

export function stopTradeFlush() {
  if (tradeFlush) clearInterval(tradeFlush);
  tradeFlush = undefined;
  tradeCtrl = undefined;
  tradeBuffers.clear();
}

const bookSyncs = new Map<string, LocalBookSync>();

export function stopBookSyncs() {
  for (const sync of bookSyncs.values()) sync.stop();
  bookSyncs.clear();
}

export const depthHandler: StreamHandler = {
  onSubscribe(ctrl, symbol) {
    let sync = bookSyncs.get(symbol);
    if (!sync) {
      sync = new LocalBookSync(symbol, ctrl);
      bookSyncs.set(symbol, sync);
    }
    sync.start();
  },
  onUnsubscribe(_ctrl, symbol) {
    bookSyncs.get(symbol)?.stop();
    bookSyncs.delete(symbol);
  },
  onMessage(_ctrl, symbol, _channel, data) {
    bookSyncs.get(symbol)?.onEvent(data);
  },
  resyncAll() {
    for (const sync of bookSyncs.values()) sync.resync();
  },
};

export const miniTickerHandler: StreamHandler = {
  onMessage(ctrl, symbol, _channel, data) {
    ctrl.set(Ticker, { symbol }, data as object);
  },
};

export const aggTradeHandler: StreamHandler = {
  onSubscribe(ctrl) {
    startTradeFlush(ctrl);
  },
  onUnsubscribe(_ctrl, symbol) {
    tradeBuffers.delete(symbol);
  },
  onMessage(ctrl, symbol, _channel, data) {
    startTradeFlush(ctrl);
    const trade = parseIncomingTrade(data);
    if (!trade) return;
    const batch = tradeBuffers.get(symbol) ?? [];
    batch.push(trade);
    tradeBuffers.set(symbol, batch);
  },
};

function parseKline(data: unknown): { interval: string; candle: Candle } | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const k = (data as { k?: Record<string, unknown> }).k;
  if (!k) return undefined;
  const interval = String(k.i ?? '');
  const candle: Candle = {
    time: Math.floor(Number(k.t) / 1000),
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
  };
  if (
    !interval ||
    !Number.isFinite(candle.time) ||
    !Number.isFinite(candle.open) ||
    !Number.isFinite(candle.high) ||
    !Number.isFinite(candle.low) ||
    !Number.isFinite(candle.close) ||
    !Number.isFinite(candle.volume)
  ) {
    return undefined;
  }
  return { interval, candle };
}

export const klineHandler: StreamHandler = {
  onMessage(ctrl, symbol, _channel, data) {
    const parsed = parseKline(data);
    if (!parsed) return;
    const interval = parsed.interval as CandleInterval;
    ctrl.set(Candles, { symbol, interval }, (prev) => {
      const last = prev.candles.at(-1);
      let candles: Candle[];
      if (last && last.time === parsed.candle.time) {
        candles = [...prev.candles.slice(0, -1), parsed.candle];
      } else {
        candles = [...prev.candles, parsed.candle].slice(-MAX_CANDLES);
      }
      return { symbol, interval, candles };
    });
  },
};

export const streamHandlers: Record<string, StreamHandler> = {
  'depth@100ms': depthHandler,
  miniTicker: miniTickerHandler,
  aggTrade: aggTradeHandler,
  kline: klineHandler,
};
