import { NetworkError } from '@data-client/rest';

import {
  getCandles,
  getOrderBook,
  getSymbolInfo,
  getTicker,
  getTickers,
  getTrades,
} from '@/resources';

import type { ScenarioRequestKind } from '../shared/types';
import type { MarketDataEndpoints } from './ResourceCatalog';

function scenarioFetchResponse(
  origin: string,
  runId: string,
  kind: ScenarioRequestKind,
) {
  return async (input: RequestInfo, init: RequestInit) => {
    const original =
      typeof input === 'string' ? new URL(input) : new URL(input.url);
    const url = new URL(
      `/api/scenarios/${encodeURIComponent(runId)}/data/${kind}`,
      origin,
    );
    url.search = original.search;
    const response = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new NetworkError(response);
    return response;
  };
}

export function createScenarioEndpoints(
  origin: string,
  runId: string,
): MarketDataEndpoints {
  return {
    getOrderBook: getOrderBook.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'book'),
    }) as typeof getOrderBook,
    getTicker: getTicker.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'ticker'),
    }) as typeof getTicker,
    getTickers: getTickers.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'tickers'),
    }) as typeof getTickers,
    getTrades: getTrades.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'trades'),
    }) as typeof getTrades,
    getCandles: getCandles.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'candles'),
    }) as typeof getCandles,
    getSymbolInfo: getSymbolInfo.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'symbol-info'),
    }) as typeof getSymbolInfo,
  };
}
