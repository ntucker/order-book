'use client';

import { createContext, useContext, type ReactNode } from 'react';

import {
  getCandles,
  getOrderBook,
  getSymbolInfo,
  getTicker,
  getTickers,
  getTrades,
} from '@/resources';

export interface MarketDataEndpoints {
  getOrderBook: typeof getOrderBook;
  getTicker: typeof getTicker;
  getTickers: typeof getTickers;
  getTrades: typeof getTrades;
  getCandles: typeof getCandles;
  getSymbolInfo: typeof getSymbolInfo;
}

export const productionEndpoints: MarketDataEndpoints = {
  getOrderBook,
  getTicker,
  getTickers,
  getTrades,
  getCandles,
  getSymbolInfo,
};

const ResourceCatalogContext =
  createContext<MarketDataEndpoints>(productionEndpoints);

export function ResourceCatalogProvider({
  value,
  children,
}: {
  value: MarketDataEndpoints;
  children: ReactNode;
}) {
  return (
    <ResourceCatalogContext value={value}>
      {children}
    </ResourceCatalogContext>
  );
}

export function useMarketDataEndpoints(): MarketDataEndpoints {
  return useContext(ResourceCatalogContext);
}
