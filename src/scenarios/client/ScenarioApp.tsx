'use client';

import { Suspense, useMemo } from 'react';

import Provider from '@/app/Provider';
import Dashboard from '@/components/dashboard/Dashboard';

import { createScenarioEndpoints } from '../resources/createScenarioEndpoints';
import { ResourceCatalogProvider } from '../resources/ResourceCatalog';
import type { ScenarioBootstrap } from '../shared/types';
import ScenarioConsole from '../ui/ScenarioConsole';
import {
  requireScenarioRuntime,
  ScenarioHydrationGate,
  ScenarioRuntimeProvider,
} from './ScenarioRuntime';

function ScenarioDashboard({
  bootstrap,
  symbol,
}: {
  bootstrap: ScenarioBootstrap;
  symbol: string;
}) {
  const runtime = requireScenarioRuntime();
  const endpoints = useMemo(
    () => createScenarioEndpoints(bootstrap.origin, bootstrap.runId),
    [bootstrap.origin, bootstrap.runId],
  );
  return (
    <div className="scenario-dashboard">
      <ScenarioHydrationGate>
        <Provider runtime={runtime}>
          <ResourceCatalogProvider value={endpoints}>
            <Dashboard
              symbol={symbol}
              scenarioPath={{
                scenarioId: bootstrap.scenarioId,
                runId: bootstrap.runId,
              }}
            />
          </ResourceCatalogProvider>
        </Provider>
      </ScenarioHydrationGate>
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
        <Suspense
          fallback={
            <div className="scenario-dashboard-frame" aria-label="Dashboard loading" />
          }
        >
          <ScenarioDashboard bootstrap={bootstrap} symbol={symbol} />
        </Suspense>
        <ScenarioConsole />
      </div>
    </ScenarioRuntimeProvider>
  );
}
