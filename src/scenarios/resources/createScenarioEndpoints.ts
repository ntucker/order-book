import { NetworkError } from '@data-client/rest';

import {
  getCandles,
  getOrderBook,
  getSymbolInfo,
  getTicker,
  getTickers,
  getTrades,
} from '@/resources';

import type { ScenarioRuntime } from '../client/ScenarioRuntime';
import type { ScenarioRequestKind } from '../shared/types';
import type { MarketDataEndpoints } from './ResourceCatalog';

function scenarioFetchResponse(
  origin: string,
  runId: string,
  kind: ScenarioRequestKind,
  runtime?: ScenarioRuntime,
) {
  return async (input: RequestInfo, init: RequestInit) => {
    const requestOrigin =
      typeof window === 'undefined' ? origin : window.location.origin;
    const original =
      typeof input === 'string' ? new URL(input) : new URL(input.url);
    const url = new URL(
      `/api/scenarios/${encodeURIComponent(runId)}/data/${kind}`,
      requestOrigin,
    );
    url.search = original.search;
    // Record locally before the hanging GET so CompletesWhen is not blocked
    // by Chrome's HTTP/1.1 six-connection limit while response gates stay closed.
    queueMicrotask(() => {
      runtime?.recordClientEvent({
        kind: 'request-started',
        source: kind,
        summary: `${kind} request started`,
      });
    });
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
  runtime?: ScenarioRuntime,
): MarketDataEndpoints {
  return {
    getOrderBook: getOrderBook.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'book', runtime),
    }) as typeof getOrderBook,
    getTicker: getTicker.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'ticker', runtime),
    }) as typeof getTicker,
    getTickers: getTickers.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'tickers', runtime),
    }) as typeof getTickers,
    getTrades: getTrades.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'trades', runtime),
    }) as typeof getTrades,
    getCandles: getCandles.extend({
      fetchResponse: scenarioFetchResponse(origin, runId, 'candles', runtime),
    }) as typeof getCandles,
    getSymbolInfo: getSymbolInfo.extend({
      fetchResponse: scenarioFetchResponse(
        origin,
        runId,
        'symbol-info',
        runtime,
      ),
    }) as typeof getSymbolInfo,
  };
}
