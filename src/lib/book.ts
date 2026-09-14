import type { Level } from '@/resources/OrderBook';

export interface CumulativeLevel {
  price: number;
  qty: number;
  total: number;
}

export function groupLevels(
  levels: readonly Level[],
  tick: number,
  side: 'bid' | 'ask',
): Level[] {
  if (tick <= 0) return levels.slice() as Level[];
  const grouped = new Map<number, number>();
  for (const [price, qty] of levels) {
    const bucket =
      side === 'bid'
        ? Math.floor(price / tick) * tick
        : Math.ceil(price / tick) * tick;
    grouped.set(bucket, (grouped.get(bucket) ?? 0) + qty);
  }
  const entries = [...grouped.entries()] as Level[];
  entries.sort((a, b) => (side === 'bid' ? b[0] - a[0] : a[0] - b[0]));
  return entries;
}

export function accumulate(levels: readonly Level[]): CumulativeLevel[] {
  let total = 0;
  return levels.map(([price, qty]) => {
    total += qty;
    return { price, qty, total };
  });
}

export function sliceRows(
  levels: readonly CumulativeLevel[],
  count: number,
): CumulativeLevel[] {
  return levels.slice(0, count);
}

export function imbalance(
  bids: readonly CumulativeLevel[],
  asks: readonly CumulativeLevel[],
): { bidPct: number; askPct: number } {
  const bidTotal = bids.at(-1)?.total ?? 0;
  const askTotal = asks.at(-1)?.total ?? 0;
  const sum = bidTotal + askTotal;
  if (sum <= 0) return { bidPct: 50, askPct: 50 };
  const bidPct = (bidTotal / sum) * 100;
  return { bidPct, askPct: 100 - bidPct };
}

export function downsample<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return points as T[];
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i += 1) {
    out.push(points[Math.round(i * step)] as T);
  }
  return out;
}
