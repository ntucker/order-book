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
import { EventLedgerManager } from '@/scenarios/client/EventLedgerManager';
import type { ScenarioRuntime } from '@/scenarios/client/ScenarioRuntime';
import { ScenarioStreamManager } from '@/scenarios/client/ScenarioStreamManager';

const streamed = new Set([OrderBook, Ticker, TradeFeed, Candles, Connection]);

export default function getManagers(runtime?: ScenarioRuntime) {
  const managers = getDefaultManagers({
    devToolsManager: {
      latency: 1000,
      predicate: (_state, action) =>
        action.type !== actionTypes.SET || !streamed.has(action.schema),
    },
  });
  if (typeof window !== 'undefined') {
    if (runtime) {
      managers.unshift(new ScenarioStreamManager(runtime));
      managers.unshift(new EventLedgerManager(runtime));
    } else {
      managers.unshift(new BinanceStreamManager(BINANCE_WS));
    }
  }
  return managers;
}
