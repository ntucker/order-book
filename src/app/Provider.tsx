'use client';

import { DataProvider } from '@data-client/react/nextjs';
import { useMemo } from 'react';

import getManagers from './getManagers';

export default function Provider({ children }: { children: React.ReactNode }) {
  const managers = useMemo(() => getManagers(), []);

  return (
    <DataProvider managers={managers} devButton={null}>
      {children}
    </DataProvider>
  );
}
