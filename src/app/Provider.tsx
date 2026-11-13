'use client';

import { DataProvider } from '@data-client/react/nextjs';

import getManagers from './getManagers';

export default function Provider({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider managers={getManagers} devButton={null}>
      {children}
    </DataProvider>
  );
}
