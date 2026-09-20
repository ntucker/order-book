import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import ScenarioApp from '@/scenarios/client/ScenarioApp';
import { getOrCreateScenarioSession } from '@/scenarios/server/registry';
import type { ScenarioBootstrap } from '@/scenarios/shared/types';

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
  const incoming = await headers();
  const protocol = incoming.get('x-forwarded-proto') ?? 'http';
  const host = incoming.get('x-forwarded-host') ?? incoming.get('host');
  if (!host) throw new Error('Scenario route requires a Host header');
  const origin = `${protocol}://${host}`;
  const status = session.status();
  const bootstrap: ScenarioBootstrap = {
    ...status,
    origin,
    initialSymbol: session.scenario.initialSymbol,
  };

  return <ScenarioApp bootstrap={bootstrap} symbol={symbol.toUpperCase()} />;
}
