import type { Metadata } from 'next';

import { scenarioDefinitions } from '@/scenarios/definitions';
import ScenarioLauncher from '@/scenarios/ui/ScenarioLauncher';

export const metadata: Metadata = {
  title: 'Scenarios · Order Book',
  description: 'Deterministic streamed order-book teaching scenarios',
};

export default function ScenariosPage() {
  const scenarios = Object.values(scenarioDefinitions).map((scenario) => ({
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary,
    posture: scenario.posture,
    symbol: scenario.initialSymbol,
  }));
  return <ScenarioLauncher scenarios={scenarios} />;
}
