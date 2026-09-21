'use client';

import { Suspense } from 'react';

import type { ScenarioBootstrap } from '../shared/types';
import ScenarioConsole from '../ui/ScenarioConsole';
import ScenarioDashboard from './ScenarioDashboard';
import { ScenarioRuntimeProvider } from './ScenarioRuntime';

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
