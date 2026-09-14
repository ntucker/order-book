# Binance Order Book

Live Binance spot dashboard built with Next.js App Router and [Reactive Data Client](https://dataclient.io).

The first paint is filled from REST snapshots during SSR (`/depth`, `/ticker/24hr`, `/aggTrades`, `/klines`). After hydrate, a custom Data Client Manager consumes `useLive` subscriptions over one `wss://data-stream.binance.vision/stream` connection:

- `<symbol>@depth@100ms` — local book synced from a REST snapshot (Binance U/u alignment, gap resync)
- `<symbol>@miniTicker` — last price and 24h stats
- `<symbol>@aggTrade` — recent trades (batched to 100ms)
- `<symbol>@kline_<interval>` — candle updates

Any TRADING spot pair works via the URL (`/LINKUSDT`). The watchlist is a shortcut.

```bash
pnpm dev
```

Open [http://localhost:3000/BTCUSDT](http://localhost:3000/BTCUSDT).
