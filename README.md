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

## Deterministic scenarios

Open [http://localhost:3000/scenarios](http://localhost:3000/scenarios) to run
the same dashboard against deterministic REST and stream fixtures. Scenario
mode exercises the real endpoint schemas, Data Client normalization and merge
rules, React boundaries, and Next.js stream; it does not contact Binance.

The runner has two clock modes:

- **Auto** releases one user-visible milestone after the previous milestone has
  painted, using a configurable 1–5 second interval.
- **Manual · time stop** releases exactly one milestone with **Advance 1
  milestone**.

The initial shell is step zero because controls must exist before time can be
stopped. Each later ledger row is a visible teaching beat. Selecting a row
shows its lower-level request, action, normalized entity, endpoint metadata,
commit, and visibility evidence. Affected-view chips highlight every registered
place where the changed entity is rendered.

Three scenarios are included:

1. **Streamed reveal and handoff** — shell, independently gated panels,
   hydration, and the first live ticker update.
2. **Newer live state wins** — an older book sequence arrives after newer live
   state and is rejected by the entity merge rule.
3. **Concurrent symbol transition** — BTC remains visible and live while ETH
   navigation prepares.

### Authoring a scenario

Scenario definitions live in `src/scenarios/definitions/`. A definition
provides immutable market fixtures and an ordered list of milestones:

```ts
{
  id: 'first-live-tick',
  title: 'One ticker update, three locations',
  explanation: 'One normalized write updates every visible occurrence.',
  releases: [{ kind: 'stream', eventId: 'ticker-newer' }],
  completesWhen: {
    kind: 'occurrences-painted',
    occurrenceIds: [
      'ticker-header-price',
      'watchlist-btc-price',
      'book-mid-price',
    ],
  },
}
```

Add the definition to `src/scenarios/definitions/index.ts`. The shared compiler,
Node session registry, transport adapters, scripted stream manager, runner, and
inspector require no per-scenario changes.

Milestones describe causal order, not raw timeout values. Automatic playback
waits for the declared completion predicate and a confirmed browser paint
before starting the next interval. React scheduling and network chunks can
still vary; the framework guarantees release order and minimum visible pacing,
not exact wall-clock timestamps.

### Runtime limitation

Stepped server rendering uses an in-memory session registry shared by the page
request and scenario control Route Handlers. It intentionally supports one
long-lived Node process. Replicated, edge, and serverless deployments need a
durable shared session coordinator before scenario mode can be enabled safely.

### Checks

```bash
pnpm test
pnpm lint
pnpm build
pnpm test:e2e
```
