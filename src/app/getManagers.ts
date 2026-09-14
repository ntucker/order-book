'use client';

import { actionTypes, getDefaultManagers } from '@data-client/react';

import {
  BINANCE_WS,
  BinanceStreamManager,
  Candles,
  Connection,
  OrderBook,
  Ticker,
  TradeFeed,
} from '@/resources';

const streamed = new Set([OrderBook, Ticker, TradeFeed, Candles, Connection]);

export default function getManagers() {
  const managers = getDefaultManagers({
    devToolsManager: {
      latency: 1000,
      predicate: (_state, action) =>
        action.type !== actionTypes.SET || !streamed.has(action.schema),
    },
  });
  if (typeof window !== 'undefined') {
    managers.unshift(new BinanceStreamManager(BINANCE_WS));
  }
  return managers;
}
