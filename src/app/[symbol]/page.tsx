import type { Metadata } from 'next';

import Dashboard from '@/components/dashboard/Dashboard';

import Provider from '../Provider';

export async function generateMetadata({
  params,
}: PageProps<'/[symbol]'>): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} · Order Book` };
}

export default async function SymbolPage({ params }: PageProps<'/[symbol]'>) {
  const { symbol } = await params;

  // TODO(data-client#4090): Move Provider back to RootLayout once the
  // upstream streamed-SSR fix ships.
  return (
    <Provider>
      <Dashboard symbol={symbol.toUpperCase()} />
    </Provider>
  );
}
