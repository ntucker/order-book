'use client';

import { useMemo } from 'react';

import Provider from '@/app/Provider';
import Dashboard from '@/components/dashboard/Dashboard';

import { createScenarioEndpoints } from '../resources/createScenarioEndpoints';
import { ResourceCatalogProvider } from '../resources/ResourceCatalog';
import type { ScenarioBootstrap } from '../shared/types';
import { useRequiredScenarioRuntime } from './ScenarioRuntime';

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
  return (
    <div className="scenario-dashboard">
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
    </div>
  );
}
