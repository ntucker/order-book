'use client';

import { DataProvider } from '@data-client/react/nextjs';
import { Suspense, useMemo } from 'react';

import getManagers from '@/app/getManagers';
import Dashboard from '@/components/dashboard/Dashboard';

import { createScenarioEndpoints } from '../resources/createScenarioEndpoints';
import { ResourceCatalogProvider } from '../resources/ResourceCatalog';
import type { ScenarioBootstrap } from '../shared/types';
import ScenarioConsole from '../ui/ScenarioConsole';
import {
  DashboardHydratedMarker,
  ScenarioRuntimeProvider,
  useRequiredScenarioRuntime,
} from './ScenarioRuntime';

function DashboardLoading() {
  return (
    <div className="scenario-dashboard">
      <div
        className="scenario-dashboard-frame"
        aria-label="Dashboard loading"
      />
    </div>
  );
}

function ScenarioDashboard({
  bootstrap,
  symbol,
}: {
  bootstrap: ScenarioBootstrap;
  symbol: string;
}) {
  const runtime = useRequiredScenarioRuntime();
  const endpoints = useMemo(
    () => createScenarioEndpoints(bootstrap.runId, runtime),
    [bootstrap.runId, runtime],
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

export default function ScenarioApp({
  bootstrap,
  symbol,
}: {
  bootstrap: ScenarioBootstrap;
  symbol: string;
}) {
  return (
    <ScenarioRuntimeProvider bootstrap={bootstrap}>
      <div className="scenario-page">
        <Suspense fallback={<DashboardLoading />}>
          <ScenarioDashboard bootstrap={bootstrap} symbol={symbol} />
        </Suspense>
        <ScenarioConsole />
      </div>
    </ScenarioRuntimeProvider>
  );
}
