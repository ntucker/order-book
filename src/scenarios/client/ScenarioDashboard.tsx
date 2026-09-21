'use client';

import { DataProvider } from '@data-client/react';
import { useMemo } from 'react';

import getManagers from '@/app/getManagers';
import Dashboard from '@/components/dashboard/Dashboard';

import { createScenarioEndpoints } from '../resources/createScenarioEndpoints';
import { ResourceCatalogProvider } from '../resources/ResourceCatalog';
import type { ScenarioBootstrap } from '../shared/types';
import {
  DashboardHydratedMarker,
  useRequiredScenarioRuntime,
} from './ScenarioRuntime';

export default function ScenarioDashboard({
  bootstrap,
  symbol,
}: {
  bootstrap: ScenarioBootstrap;
  symbol: string;
}) {
  const runtime = useRequiredScenarioRuntime();
  const endpoints = useMemo(
    () => createScenarioEndpoints(bootstrap.origin, bootstrap.runId, runtime),
    [bootstrap.origin, bootstrap.runId, runtime],
  );
  const managers = useMemo(() => getManagers(runtime), [runtime]);
  return (
    <div className="scenario-dashboard" data-scenario-dashboard="">
      <DataProvider managers={managers} devButton={null}>
        <DashboardHydratedMarker />
        <ResourceCatalogProvider value={endpoints}>
          <Dashboard
            symbol={symbol}
            scenarioPath={{
              scenarioId: bootstrap.scenarioId,
              runId: bootstrap.runId,
            }}
          />
        </ResourceCatalogProvider>
      </DataProvider>
    </div>
  );
}
