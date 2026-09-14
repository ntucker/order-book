'use client';

import { useLive, useSuspense } from '@data-client/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

import {
  CANDLE_INTERVALS,
  getCandles,
  getSymbolInfo,
  type CandleInterval,
} from '@/resources';

import Panel from '../panel/Panel';
import skeleton from '../panel/PanelSkeleton.module.css';
import Segmented from '../ui/Segmented';

const CandleChart = dynamic(() => import('./CandleChart'), {
  ssr: false,
  loading: () => <div className={skeleton.chart} />,
});

export default function CandleChartPanel({ symbol }: { symbol: string }) {
  const info = useSuspense(getSymbolInfo, { symbol });
  const [interval, setInterval] = useState<CandleInterval>('1m');
  const series = useLive(getCandles, { symbol, interval });

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
      <CandleChart candles={series.candles} />
    </Panel>
  );
}
