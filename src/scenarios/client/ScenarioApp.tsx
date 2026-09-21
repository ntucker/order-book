'use client';

import { Suspense, useSyncExternalStore } from 'react';

import type { ScenarioBootstrap } from '../shared/types';
import ScenarioConsole from '../ui/ScenarioConsole';
import ScenarioDashboard from './ScenarioDashboard';
import { ScenarioRuntimeProvider } from './ScenarioRuntime';

function subscribeNever() {
  return () => {};
}

function useClientDashboard() {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}

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

export default function ScenarioApp({
  bootstrap,
  symbol,
}: {
  bootstrap: ScenarioBootstrap;
  symbol: string;
}) {
  const dashboardReady = useClientDashboard();

  return (
    <ScenarioRuntimeProvider bootstrap={bootstrap}>
      <div className="scenario-page">
        {dashboardReady ? (
          <Suspense fallback={<DashboardLoading />}>
            <ScenarioDashboard bootstrap={bootstrap} symbol={symbol} />
          </Suspense>
        ) : (
          <DashboardLoading />
        )}
        <ScenarioConsole />
      </div>
    </ScenarioRuntimeProvider>
  );
}
