import type {
  ScenarioCandleInterval,
  ScenarioFixtures,
  ScenarioMarketFixture,
} from '../shared/types';

const CANDLE_INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

const SYMBOLS = [
  ['BTCUSDT', 'BTC', 100],
  ['ETHUSDT', 'ETH', 32],
  ['SOLUSDT', 'SOL', 14],
  ['BNBUSDT', 'BNB', 58],
  ['XRPUSDT', 'XRP', 2],
  ['DOGEUSDT', 'DOGE', 0.2],
  ['ADAUSDT', 'ADA', 0.8],
  ['AVAXUSDT', 'AVAX', 18],
] as const;

function candles(price: number, interval: ScenarioCandleInterval) {
  const intervalIndex = CANDLE_INTERVALS.indexOf(interval);
  return Array.from({ length: 36 }, (_, index) => {
    const drift = (index - 18) * price * 0.0006;
    const open = price + drift;
    const close = open + (index % 2 === 0 ? 1 : -1) * price * 0.0015;
    return [
      1_700_000_000_000 + (intervalIndex * 100 + index) * 60_000,
      open.toFixed(6),
      Math.max(open, close).toFixed(6),
      Math.min(open, close).toFixed(6),
      close.toFixed(6),
      (12 + index * 0.4).toFixed(4),
    ];
  });
}

function market(
  symbol: string,
  baseAsset: string,
  price: number,
  updateId = 500,
): ScenarioMarketFixture {
  const precision = price < 1 ? 4 : 2;
  const step = 10 ** -precision;
  const levels = Array.from({ length: 36 }, (_, index) => index + 1);
  return {
    symbol,
    baseAsset,
    quoteAsset: 'USDT',
    tickSize: step.toFixed(precision),
    stepSize: '0.00010',
    ticker: {
      symbol,
      lastPrice: price,
      openPrice: price * 0.988,
      highPrice: price * 1.018,
      lowPrice: price * 0.976,
      volume: 24_000,
      quoteVolume: 2_400_000,
      direction: 'flat',
    },
    book: {
      lastUpdateId: updateId,
      bids: levels.map((level) => [
        (price - level * step).toFixed(precision),
        (1 + level * 0.07).toFixed(5),
      ]),
      asks: levels.map((level) => [
        (price + level * step).toFixed(precision),
        (1.2 + level * 0.06).toFixed(5),
      ]),
    },
    trades: Array.from({ length: 40 }, (_, index) => ({
      a: 10_000 - index,
      p: (price + (index % 3 - 1) * step).toFixed(precision),
      q: (0.2 + index * 0.01).toFixed(5),
      T: 1_700_000_000_000 - index * 1_000,
      m: index % 2 === 0,
    })),
    candles: Object.fromEntries(
      CANDLE_INTERVALS.map((interval) => [interval, candles(price, interval)]),
    ) as Record<ScenarioCandleInterval, unknown[][]>,
  };
}

const markets = Object.fromEntries(
  SYMBOLS.map(([symbol, baseAsset, price]) => [
    symbol,
    market(symbol, baseAsset, price),
  ]),
);

export const baseFixtures: ScenarioFixtures = {
  markets,
  watchlist: SYMBOLS.map(([symbol]) => symbol),
  responseGates: {
    'symbol-info': 'response:symbol-info',
    ticker: 'response:ticker',
    tickers: 'response:tickers',
    book: 'response:book',
    trades: 'response:trades',
    candles: 'response:candles',
  },
  streamEvents: {
      'ticker-newer': {
        stream: 'btcusdt@miniTicker',
        data: {
          s: 'BTCUSDT',
          c: '100.05',
          o: '98.8',
          h: '102.1',
          l: '97.6',
          v: '24040',
          q: '2405200',
        },
        occurrenceIds: [
          'ticker-header-price',
          'watchlist-btc-price',
          'book-mid-price',
        ],
      },
      'book-newer': {
        stream: 'btcusdt@depth@100ms',
        data: {
          U: 501,
          u: 520,
          b: [['100.04', '2.5']],
          a: [
            ['100.01', '0'],
            ['100.02', '0'],
            ['100.03', '0'],
            ['100.04', '0'],
            ['100.05', '0'],
            ['100.06', '2.2'],
          ],
        },
        occurrenceIds: ['book-panel'],
      },
      'book-older': {
        stream: 'btcusdt@depth@100ms',
        data: {
          U: 490,
          u: 499,
          b: [['99.98', '8.0']],
          a: [['100.02', '8.0']],
        },
        occurrenceIds: ['book-panel'],
      },
      'btc-transition-tick': {
        stream: 'btcusdt@miniTicker',
        data: {
          s: 'BTCUSDT',
          c: '100.08',
          o: '98.8',
          h: '102.1',
          l: '97.6',
          v: '24080',
          q: '2409000',
        },
        occurrenceIds: [
          'ticker-header-price',
          'watchlist-btc-price',
          'book-mid-price',
        ],
      },
  },
};
