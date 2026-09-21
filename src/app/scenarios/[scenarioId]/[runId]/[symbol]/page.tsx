import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import ScenarioApp from '@/scenarios/client/ScenarioApp';
import { getOrCreateScenarioSession } from '@/scenarios/server/registry';
import type { ScenarioBootstrap } from '@/scenarios/shared/types';

export const dynamic = 'force-dynamic';

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
  const bootstrap: ScenarioBootstrap = {
    ...session.status(),
    initialSymbol: session.scenario.initialSymbol,
  };

  return <ScenarioApp bootstrap={bootstrap} symbol={symbol.toUpperCase()} />;
}
