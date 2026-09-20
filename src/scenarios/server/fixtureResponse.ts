import 'server-only';

import type {
  ScenarioMarketFixture,
  ScenarioRequestKind,
} from '../shared/types';
import type { ScenarioSession } from './ScenarioSession';

function requireMarket(
  session: ScenarioSession,
  symbol: string | null,
): ScenarioMarketFixture {
  const upper = symbol?.toUpperCase() ?? '';
  const market = session.scenario.fixtures.markets[upper];
  if (!market) throw new Error(`No fixture for symbol "${upper}"`);
  return market;
}

function symbolInfo(market: ScenarioMarketFixture) {
  return {
    symbols: [
      {
        symbol: market.symbol,
        baseAsset: market.baseAsset,
        quoteAsset: market.quoteAsset,
        status: 'TRADING',
        filters: [
          { filterType: 'PRICE_FILTER', tickSize: market.tickSize },
          { filterType: 'LOT_SIZE', stepSize: market.stepSize },
        ],
      },
    ],
  };
}

export function fixtureResponse(
  session: ScenarioSession,
  kind: ScenarioRequestKind,
  search: URLSearchParams,
): unknown {
  switch (kind) {
    case 'symbol-info':
      return symbolInfo(requireMarket(session, search.get('symbol')));
    case 'ticker':
      return requireMarket(session, search.get('symbol')).ticker;
    case 'tickers': {
      const raw = search.get('symbols');
      const symbols =
        raw
          ? (JSON.parse(raw) as string[])
          : session.scenario.fixtures.watchlist;
      return symbols.map(
        (symbol) => requireMarket(session, symbol).ticker,
      );
    }
    case 'book':
      return requireMarket(session, search.get('symbol')).book;
    case 'trades':
      return requireMarket(session, search.get('symbol')).trades;
    case 'candles': {
      const market = requireMarket(session, search.get('symbol'));
      const interval = search.get('interval') ?? '1m';
      return market.candles[
        interval as keyof ScenarioMarketFixture['candles']
      ];
    }
  }
}
