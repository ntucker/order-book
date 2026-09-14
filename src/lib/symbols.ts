export const WATCHLIST = [
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'BNBUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
] as const;

const QUOTE_SUFFIXES = [
  'USDT',
  'USDC',
  'FDUSD',
  'TUSD',
  'BUSD',
  'BTC',
  'ETH',
  'BNB',
  'EUR',
  'TRY',
] as const;

export function splitSymbol(symbol: string): [base: string, quote: string] {
  const upper = symbol.toUpperCase();
  for (const quote of QUOTE_SUFFIXES) {
    if (upper.endsWith(quote) && upper.length > quote.length) {
      return [upper.slice(0, -quote.length), quote];
    }
  }
  return [upper, ''];
}
