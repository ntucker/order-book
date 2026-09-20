'use client';

import { useLive, useSuspense } from '@data-client/react';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';

import {
  CANDLE_INTERVALS,
  type CandleInterval,
} from '@/resources';
import { useScenarioOccurrence } from '@/scenarios/client/ScenarioRuntime';
import { useMarketDataEndpoints } from '@/scenarios/resources/ResourceCatalog';

import Panel from '../panel/Panel';
import skeleton from '../panel/PanelSkeleton.module.css';
import Segmented from '../ui/Segmented';

const CandleChart = dynamic(() => import('./CandleChart'), {
  ssr: false,
  loading: () => <div className={skeleton.chart} />,
});

export default function CandleChartPanel({ symbol }: { symbol: string }) {
  const { getCandles, getSymbolInfo } = useMarketDataEndpoints();
  const info = useSuspense(getSymbolInfo, { symbol });
  const [interval, setInterval] = useState<CandleInterval>('1m');
  const series = useLive(getCandles, { symbol, interval });
  const chartRef = useRef<HTMLDivElement>(null);
  useScenarioOccurrence(chartRef, {
    occurrenceId: 'chart-panel',
    viewId: 'candle-chart',
    label: 'Candle chart',
    entityPaths: [{ key: 'Candles', pk: `${symbol}:${interval}` }],
    mobilePane: 'chart',
  });

  return (
    <Panel
      title={`${info.baseAsset}/${info.quoteAsset}`}
      meta={interval}
      controls={
        <Segmented
          ariaLabel="Candle interval"
          value={interval}
          onChange={setInterval}
          options={CANDLE_INTERVALS.map((value) => ({
            value,
            label: value,
          }))}
        />
      }
    >
      <div ref={chartRef} style={{ height: '100%' }}>
        <CandleChart candles={series.candles} />
      </div>
    </Panel>
  );
}
