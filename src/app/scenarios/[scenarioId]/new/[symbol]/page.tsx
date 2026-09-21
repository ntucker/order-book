import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function NewScenarioRunPage({
  params,
}: {
  params: Promise<{ scenarioId: string; symbol: string }>;
}) {
  const { scenarioId, symbol } = await params;
  redirect(
    `/scenarios/${encodeURIComponent(scenarioId)}/${crypto.randomUUID()}/${encodeURIComponent(symbol)}`,
  );
}
