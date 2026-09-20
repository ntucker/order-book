'use client';

import { useRouter } from 'next/navigation';

import styles from './ScenarioLauncher.module.css';

export default function ScenarioLauncher({
  scenarios,
}: {
  scenarios: { id: string; title: string; summary: string; symbol: string }[];
}) {
  const router = useRouter();
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Reactive Data Client laboratory</span>
        <h1>Deterministic order-book scenarios</h1>
        <p>
          Stop time, advance one visible change, and inspect the normalized
          store impact beneath the real dashboard.
        </p>
      </header>
      <div className={styles.grid}>
        {scenarios.map((scenario, index) => (
          <article className={styles.card} key={scenario.id}>
            <span className={styles.number}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2>{scenario.title}</h2>
            <p>{scenario.summary}</p>
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/scenarios/${scenario.id}/${crypto.randomUUID()}/${scenario.symbol}`,
                )
              }
            >
              Open scenario <span aria-hidden="true">→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
