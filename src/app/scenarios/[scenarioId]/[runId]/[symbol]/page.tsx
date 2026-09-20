import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ScenarioApp from '@/scenarios/client/ScenarioApp';
import { getOrCreateScenarioSession } from '@/scenarios/server/registry';
import type { ScenarioBootstrap } from '@/scenarios/shared/types';

function trustedScenarioOrigin(): string {
  const configured =
    process.env.SCENARIO_SERVER_ORIGIN ??
    (process.env.NODE_ENV === 'development'
      ? 'http://127.0.0.1:3000'
      : undefined);
  if (!configured) {
    throw new Error('Production scenarios require SCENARIO_SERVER_ORIGIN');
  }
  const origin = new URL(configured);
  if (origin.protocol !== 'http:' && origin.protocol !== 'https:') {
    throw new Error('SCENARIO_SERVER_ORIGIN must use HTTP or HTTPS');
  }
  return origin.origin;
}

export async function generateMetadata({
  params,
}: PageProps<'/scenarios/[scenarioId]/[runId]/[symbol]'>): Promise<Metadata> {
  const { scenarioId } = await params;
  return { title: `${scenarioId} · Order Book Scenarios` };
}

export default async function ScenarioPage({
  params,
}: PageProps<'/scenarios/[scenarioId]/[runId]/[symbol]'>) {
  const { scenarioId, runId, symbol } = await params;
  let session;
  try {
    session = getOrCreateScenarioSession(runId, scenarioId);
  } catch {
    notFound();
  }
  const origin = trustedScenarioOrigin();
  const status = session.status();
  const bootstrap: ScenarioBootstrap = {
    ...status,
    origin,
    initialSymbol: session.scenario.initialSymbol,
  };

  return <ScenarioApp bootstrap={bootstrap} symbol={symbol.toUpperCase()} />;
}
