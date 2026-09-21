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
  runId: string,
  kind: ScenarioRequestKind,
  runtime?: ScenarioRuntime,
) {
  return async (input: RequestInfo, init: RequestInit) => {
    const original =
      typeof input === 'string' ? new URL(input) : new URL(input.url);
    if (typeof window === 'undefined') {
      // Same process as the page render. A hanging same-origin GET
      // deadlocks webpack `next dev` (one request slot).
      const { serveInProcessFixture } = await import(
        '../server/serveInProcessFixture'
      );
      const response = await serveInProcessFixture(
        runId,
        kind,
        original.search.startsWith('?')
          ? original.search.slice(1)
          : original.search,
      );
      if (response.status === 425) {
        throw new DOMException('Response gate closed', 'AbortError');
      }
      if (!response.ok) throw new NetworkError(response);
      return response;
    }
    const url = new URL(
      `/api/scenarios/${encodeURIComponent(runId)}/data/${kind}`,
      window.location.origin,
    );
    url.search = original.search;
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
  _origin: string,
  runId: string,
  runtime?: ScenarioRuntime,
): MarketDataEndpoints {
  return {
    getOrderBook: getOrderBook.extend({
      fetchResponse: scenarioFetchResponse(runId, 'book', runtime),
    }) as typeof getOrderBook,
    getTicker: getTicker.extend({
      fetchResponse: scenarioFetchResponse(runId, 'ticker', runtime),
    }) as typeof getTicker,
    getTickers: getTickers.extend({
      fetchResponse: scenarioFetchResponse(runId, 'tickers', runtime),
    }) as typeof getTickers,
    getTrades: getTrades.extend({
      fetchResponse: scenarioFetchResponse(runId, 'trades', runtime),
    }) as typeof getTrades,
    getCandles: getCandles.extend({
      fetchResponse: scenarioFetchResponse(runId, 'candles', runtime),
    }) as typeof getCandles,
    getSymbolInfo: getSymbolInfo.extend({
      fetchResponse: scenarioFetchResponse(runId, 'symbol-info', runtime),
    }) as typeof getSymbolInfo,
  };
}
