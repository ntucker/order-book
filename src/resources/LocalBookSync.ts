import type { Controller } from '@data-client/react';

import { BINANCE_REST, binanceFetch, binanceRetryDelay } from './binance';
import { BOOK_LIMIT, OrderBook, type Level } from './OrderBook';

export interface DepthEvent {
  U: number;
  u: number;
  b?: unknown;
  a?: unknown;
}

function asEvent(data: unknown): DepthEvent | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const row = data as Record<string, unknown>;
  const U = Number(row.U);
  const u = Number(row.u);
  if (!Number.isFinite(U) || !Number.isFinite(u)) return undefined;
  return { U, u, b: row.b, a: row.a };
}

function applySide(map: Map<number, number>, levels: unknown) {
  if (!Array.isArray(levels)) return;
  for (const level of levels) {
    if (!Array.isArray(level) || level.length < 2) continue;
    const price = Number(level[0]);
    const qty = Number(level[1]);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) continue;
    if (qty === 0) map.delete(price);
    else map.set(price, qty);
  }
}

export class LocalBookSync {
  protected generation = 0;
  protected state: 'idle' | 'buffering' | 'synced' = 'idle';
  protected buffer: DepthEvent[] = [];
  protected bids = new Map<number, number>();
  protected asks = new Map<number, number>();
  protected bidTuples = new Map<number, Level>();
  protected askTuples = new Map<number, Level>();
  protected localId = 0;
  protected pruneTimer?: ReturnType<typeof setInterval>;
  protected alignTimer?: ReturnType<typeof setTimeout>;
  protected waitTimer?: ReturnType<typeof setTimeout>;
  protected waitResolve?: () => void;
  protected failStreak = 0;
  protected gaps = 0;
  /** Hydrate from the store once; after a gap, only a REST snapshot is valid. */
  protected useStore = true;

  constructor(
    protected symbol: string,
    protected ctrl: Controller,
  ) {}

  start() {
    this.resync({ useStore: true });
  }

  stop() {
    this.generation += 1;
    this.state = 'idle';
    this.buffer = [];
    this.bids.clear();
    this.asks.clear();
    this.bidTuples.clear();
    this.askTuples.clear();
    this.clearTimers();
  }

  resync(options?: { seed?: DepthEvent; useStore?: boolean }) {
    this.generation += 1;
    this.state = 'buffering';
    this.buffer = options?.seed ? [options.seed] : [];
    this.useStore = options?.useStore ?? false;
    this.bids.clear();
    this.asks.clear();
    this.clearTimers();
    const delay =
      this.failStreak === 0
        ? 0
        : Math.min(10_000, 250 * 2 ** (this.failStreak - 1));
    this.failStreak += 1;
    this.alignTimer = setTimeout(() => {
      this.alignTimer = undefined;
      void this.align(this.generation);
    }, delay);
  }

  onEvent(data: unknown) {
    const event = asEvent(data);
    if (!event || this.state === 'idle') return;
    if (this.state === 'buffering') {
      this.buffer.push(event);
      if (this.buffer.length > 1000) this.resync();
      return;
    }
    this.applyLive(event);
  }

  protected async align(generation: number) {
    if (this.useStore) {
      const stored = this.ctrl.get(
        OrderBook,
        { symbol: this.symbol },
        this.ctrl.getState(),
      );
      if (stored && this.commitSnapshot(stored)) return;
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let snapshot: { lastUpdateId: number; bids: Level[]; asks: Level[] };
      try {
        if (!(await this.wait(binanceRetryDelay(), generation))) return;
        const res = await binanceFetch(
          `${BINANCE_REST}/depth?symbol=${encodeURIComponent(this.symbol)}&limit=${BOOK_LIMIT}`,
        );
        if (generation !== this.generation) return;
        snapshot = OrderBook.process(await res.json(), undefined, undefined, [
          { symbol: this.symbol },
        ]);
      } catch (e) {
        console.error('Failed to fetch depth snapshot', e);
        if (
          !(await this.wait(
            Math.max(binanceRetryDelay(), 250 * (attempt + 1)),
            generation,
          ))
        ) {
          return;
        }
        continue;
      }
      if (generation !== this.generation) return;
      if (this.commitSnapshot(snapshot)) return;
      if (!(await this.wait(250 * (attempt + 1), generation))) return;
    }
    if (generation === this.generation) this.resync();
  }

  /** Apply a snapshot if stream events overlap it (`U <= lastUpdateId+1`). */
  protected commitSnapshot(snapshot: {
    lastUpdateId: number;
    bids: Level[];
    asks: Level[];
  }): boolean {
    const first = this.buffer[0];
    if (first && first.U > snapshot.lastUpdateId + 1) return false;
    const pending = this.buffer.filter(
      (event) => event.u > snapshot.lastUpdateId,
    );
    if (pending[0] && pending[0].U > snapshot.lastUpdateId + 1) return false;
    this.loadSnapshot(snapshot);
    for (const event of pending) {
      if (this.applyEvent(event) === 'gap') {
        this.noteGap();
        return false;
      }
    }
    this.buffer = [];
    this.state = 'synced';
    this.failStreak = 0;
    this.useStore = true;
    this.emit();
    this.schedulePrune();
    return true;
  }

  protected loadSnapshot(snapshot: {
    lastUpdateId: number;
    bids: Level[];
    asks: Level[];
  }) {
    this.bids.clear();
    this.asks.clear();
    for (const [price, qty] of snapshot.bids) this.bids.set(price, qty);
    for (const [price, qty] of snapshot.asks) this.asks.set(price, qty);
    this.localId = snapshot.lastUpdateId;
  }

  protected applyLive(event: DepthEvent) {
    const result = this.applyEvent(event);
    if (result === 'gap') {
      this.noteGap();
      this.resync({ seed: event });
      return;
    }
    if (result === 'applied') this.emit();
  }

  protected applyEvent(event: DepthEvent): 'applied' | 'ignore' | 'gap' {
    if (event.u <= this.localId) return 'ignore';
    if (event.U > this.localId + 1) return 'gap';
    applySide(this.bids, event.b);
    applySide(this.asks, event.a);
    this.localId = event.u;
    return 'applied';
  }

  protected emit() {
    this.ctrl.set(OrderBook, { symbol: this.symbol }, {
      lastUpdateId: this.localId,
      bids: this.takeSide(this.bids, this.bidTuples, true),
      asks: this.takeSide(this.asks, this.askTuples, false),
    });
  }

  protected takeSide(
    map: Map<number, number>,
    tuples: Map<number, Level>,
    desc: boolean,
  ): Level[] {
    const entries = [...map.entries()];
    entries.sort((a, b) => (desc ? b[0] - a[0] : a[0] - b[0]));
    const top = entries.slice(0, BOOK_LIMIT);
    const next = new Map<number, Level>();
    const out = top.map(([price, qty]) => {
      const prev = tuples.get(price);
      if (prev && prev[1] === qty) {
        next.set(price, prev);
        return prev;
      }
      const tuple: Level = [price, qty];
      next.set(price, tuple);
      return tuple;
    });
    tuples.clear();
    for (const [price, tuple] of next) tuples.set(price, tuple);
    return out;
  }

  protected schedulePrune() {
    this.clearPrune();
    this.pruneTimer = setInterval(() => {
      if (this.bids.size > BOOK_LIMIT * 2 || this.asks.size > BOOK_LIMIT * 2) {
        this.resync();
      }
    }, 5000);
  }

  protected async wait(ms: number, generation: number) {
    if (generation !== this.generation) return false;
    if (ms <= 0) return true;
    await new Promise<void>((resolve) => {
      this.waitResolve = resolve;
      this.waitTimer = setTimeout(() => {
        this.waitTimer = undefined;
        this.waitResolve = undefined;
        resolve();
      }, ms);
    });
    return generation === this.generation;
  }

  protected noteGap() {
    if (process.env.NODE_ENV !== 'production') {
      this.gaps += 1;
      console.warn('order book gap', this.symbol, this.gaps);
    }
  }

  protected clearPrune() {
    if (this.pruneTimer) clearInterval(this.pruneTimer);
    this.pruneTimer = undefined;
  }

  protected clearTimers() {
    this.clearPrune();
    if (this.alignTimer) clearTimeout(this.alignTimer);
    this.alignTimer = undefined;
    if (this.waitTimer) clearTimeout(this.waitTimer);
    this.waitTimer = undefined;
    this.waitResolve?.();
    this.waitResolve = undefined;
  }
}
