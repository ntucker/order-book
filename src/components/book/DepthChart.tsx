'use client';

import { useLive, useSuspense } from '@data-client/react';
import { useMemo, useState, type MouseEvent } from 'react';

import { useElementSize } from '@/hooks/useElementSize';
import { accumulate, downsample } from '@/lib/book';
import { formatNumber } from '@/lib/format';
import { useScenarioOccurrence } from '@/scenarios/client/ScenarioRuntime';
import { useMarketDataEndpoints } from '@/scenarios/resources/ResourceCatalog';

import Panel from '../panel/Panel';
import styles from './DepthChart.module.css';

const PAD = { top: 12, right: 52, bottom: 24, left: 8 };

function stepArea(
  points: { x: number; y: number }[],
  baseline: number,
): string {
  if (!points.length) return '';
  const first = points[0];
  let d = `M ${first.x} ${baseline} V ${first.y}`;
  for (let i = 1; i < points.length; i += 1) {
    const cur = points[i];
    d += ` H ${cur.x} V ${cur.y}`;
  }
  d += ` V ${baseline} Z`;
  return d;
}

export default function DepthChart({ symbol }: { symbol: string }) {
  const { getOrderBook, getSymbolInfo } = useMarketDataEndpoints();
  const info = useSuspense(getSymbolInfo, { symbol });
  const book = useLive(getOrderBook, { symbol });
  const [ref, size] = useElementSize<HTMLDivElement>();
  useScenarioOccurrence(ref, {
    occurrenceId: 'depth-panel',
    entityPaths: [{ key: 'OrderBook', pk: symbol }],
  });
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    price: number;
    total: number;
  } | null>(null);

  const width = Math.max(size.width, 1);
  const height = Math.max(size.height, 1);
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = Math.max(height - PAD.top - PAD.bottom, 1);

  const model = useMemo(() => {
    const bids = accumulate(book.bids);
    const asks = accumulate(book.asks);
    const mid = book.midPrice;
    const lowestBid = bids.at(-1)?.price ?? mid;
    const highestAsk = asks.at(-1)?.price ?? mid;
    const rawRange = Math.min(mid - lowestBid, highestAsk - mid);
    const range = Math.min(rawRange, mid * 0.01) || mid * 0.001;
    const minP = mid - range;
    const maxP = mid + range;
    const visBids = downsample(
      bids.filter((l) => l.price >= minP),
      200,
    );
    const visAsks = downsample(
      asks.filter((l) => l.price <= maxP),
      200,
    );
    const maxQty = Math.max(
      visBids.at(-1)?.total ?? 0,
      visAsks.at(-1)?.total ?? 0,
      1,
    );
    const xOf = (price: number) =>
      PAD.left + ((price - minP) / (maxP - minP || 1)) * innerW;
    const yOf = (total: number) =>
      PAD.top + innerH - (total / maxQty) * innerH;
    return {
      mid,
      minP,
      maxP,
      maxQty,
      xOf,
      yOf,
      midX: xOf(mid),
      bids: visBids,
      asks: visAsks,
      bidPath: stepArea(
        visBids.map((l) => ({ x: xOf(l.price), y: yOf(l.total) })),
        PAD.top + innerH,
      ),
      askPath: stepArea(
        visAsks.map((l) => ({ x: xOf(l.price), y: yOf(l.total) })),
        PAD.top + innerH,
      ),
    };
  }, [book, innerW, innerH]);

  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => model.minP + t * (model.maxP - model.minP));
  const yTicks = [0, 0.5, 1].map((t) => model.maxQty * t);

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const price =
      model.minP + ((x - PAD.left) / innerW) * (model.maxP - model.minP);
    const side = price <= model.mid ? model.bids : model.asks;
    if (!side.length) return;
    let nearest = side[0];
    for (const level of side) {
      if (Math.abs(level.price - price) < Math.abs(nearest.price - price)) {
        nearest = level;
      }
    }
    const tipX = model.xOf(nearest.price);
    setHover({
      x: tipX > width - 140 ? tipX - 140 : tipX + 8,
      y: 16,
      price: nearest.price,
      total: nearest.total,
    });
  };

  return (
    <Panel title="Depth">
      <div className={styles.wrap} ref={ref}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="bidFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--bid)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--bid)" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="askFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ask)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--ask)" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {yTicks.map((qty) => (
            <line
              key={qty}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={model.yOf(qty)}
              y2={model.yOf(qty)}
              stroke="var(--border)"
              strokeWidth="1"
            />
          ))}
          <path d={model.bidPath} fill="url(#bidFill)" stroke="var(--bid)" strokeWidth="1.5" />
          <path d={model.askPath} fill="url(#askFill)" stroke="var(--ask)" strokeWidth="1.5" />
          <line
            x1={model.midX}
            x2={model.midX}
            y1={PAD.top}
            y2={PAD.top + innerH}
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {xTicks.map((price) => (
            <text
              key={price}
              className={styles.label}
              x={model.xOf(price)}
              y={height - 6}
              textAnchor="middle"
            >
              {formatNumber(price, info.priceDecimals)}
            </text>
          ))}
          {yTicks.map((qty) => (
            <text
              key={`y-${qty}`}
              className={styles.label}
              x={width - 6}
              y={model.yOf(qty) + 4}
              textAnchor="end"
            >
              {formatNumber(qty, info.qtyDecimals)}
            </text>
          ))}
          {hover ? (
            <line
              x1={model.xOf(hover.price)}
              x2={model.xOf(hover.price)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--text-3)"
              strokeWidth="1"
            />
          ) : null}
        </svg>
        {hover ? (
          <div className={styles.tooltip} style={{ left: hover.x, top: hover.y }}>
            {formatNumber(hover.price, info.priceDecimals)} · Σ{' '}
            {formatNumber(hover.total, info.qtyDecimals)} {info.baseAsset}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
