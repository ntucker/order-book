'use client';

import { DataProvider } from '@data-client/react/nextjs';
import { useMemo } from 'react';

import {
  DashboardHydratedMarker,
  type ScenarioRuntime,
} from '@/scenarios/client/ScenarioRuntime';

import getManagers from './getManagers';

export default function Provider({
  children,
  runtime,
}: {
  children: React.ReactNode;
  runtime?: ScenarioRuntime;
}) {
  const managers = useMemo(() => getManagers(runtime), [runtime]);

  return (
    <DataProvider managers={managers} devButton={null}>
      {runtime ? <DashboardHydratedMarker /> : null}
      {children}
    </DataProvider>
  );
}
