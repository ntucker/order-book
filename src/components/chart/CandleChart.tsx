'use client';

import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useRef } from 'react';

import type { Candle } from '@/resources';

function readTheme() {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue('--text-3').trim() || '#737e8f',
    border: css.getPropertyValue('--border').trim() || '#1c232d',
    borderStrong: css.getPropertyValue('--border-strong').trim() || '#2a3441',
    surface3: css.getPropertyValue('--surface-3').trim() || '#1e2632',
    bid: css.getPropertyValue('--bid').trim() || '#16c784',
    ask: css.getPropertyValue('--ask').trim() || '#ea3943',
    font: css.getPropertyValue('--font-num').trim() || 'monospace',
  };
}

function toCandle(c: Candle) {
  return {
    time: c.time as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function toVolume(c: Candle, bid: string, ask: string) {
  return {
    time: c.time as UTCTimestamp,
    value: c.volume,
    color: `${c.close >= c.open ? bid : ask}66`,
  };
}

export default function CandleChart({ candles }: { candles: Candle[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi>(undefined);
  const candleRef = useRef<ISeriesApi<'Candlestick'>>(undefined);
  const volumeRef = useRef<ISeriesApi<'Histogram'>>(undefined);
  const lastApplied = useRef<{ time: number; length: number }>({
    time: 0,
    length: 0,
  });

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const theme = readTheme();
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: theme.text,
        fontFamily: theme.font,
      },
      grid: {
        vertLines: { color: theme.border },
        horzLines: { color: theme.border },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: theme.borderStrong,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme.surface3,
        },
        horzLine: {
          color: theme.borderStrong,
          style: LineStyle.Dashed,
          labelBackgroundColor: theme.surface3,
        },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        rightOffset: 4,
        barSpacing: 6,
        timeVisible: true,
      },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: theme.bid,
      downColor: theme.ask,
      borderVisible: false,
      wickUpColor: theme.bid,
      wickDownColor: theme.ask,
    });
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const next = readTheme();
      chart.applyOptions({
        layout: { textColor: next.text, fontFamily: next.font },
        grid: {
          vertLines: { color: next.border },
          horzLines: { color: next.border },
        },
        crosshair: {
          vertLine: {
            color: next.borderStrong,
            labelBackgroundColor: next.surface3,
          },
          horzLine: {
            color: next.borderStrong,
            labelBackgroundColor: next.surface3,
          },
        },
      });
      candleSeries.applyOptions({
        upColor: next.bid,
        downColor: next.ask,
        wickUpColor: next.bid,
        wickDownColor: next.ask,
      });
    };
    media.addEventListener('change', applyTheme);

    return () => {
      media.removeEventListener('change', applyTheme);
      chart.remove();
      chartRef.current = undefined;
      candleRef.current = undefined;
      volumeRef.current = undefined;
      lastApplied.current = { time: 0, length: 0 };
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleRef.current;
    const volumeSeries = volumeRef.current;
    if (!candleSeries || !volumeSeries) return;
    const theme = readTheme();
    const last = candles.at(-1);
    const prev = lastApplied.current;
    const incremental =
      last &&
      candles.length > 0 &&
      (candles.length === prev.length || candles.length === prev.length + 1) &&
      (last.time === prev.time || prev.time === candles.at(-2)?.time);
    if (incremental && last) {
      candleSeries.update(toCandle(last));
      volumeSeries.update(toVolume(last, theme.bid, theme.ask));
    } else {
      candleSeries.setData(candles.map(toCandle));
      volumeSeries.setData(
        candles.map((c) => toVolume(c, theme.bid, theme.ask)),
      );
    }
    lastApplied.current = {
      time: last?.time ?? 0,
      length: candles.length,
    };
  }, [candles]);

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />;
}
