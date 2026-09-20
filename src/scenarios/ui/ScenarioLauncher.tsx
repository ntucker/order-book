'use client';

import { useRouter } from 'next/navigation';

import { POSTURE_HINT, POSTURE_LABEL } from '../shared/posture';
import type { ScenarioPosture } from '../shared/types';
import styles from './ScenarioLauncher.module.css';

export default function ScenarioLauncher({
  scenarios,
}: {
  scenarios: {
    id: string;
    title: string;
    summary: string;
    posture: ScenarioPosture;
    symbol: string;
  }[];
}) {
  const router = useRouter();
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Reactive Data Client laboratory</span>
        <h1>Deterministic order-book scenarios</h1>
        <p>
          Stop time, advance one visible change, and inspect the normalized
          store impact beneath the real dashboard. Ledger diamonds record that
          a step happened. Only cards marked Lock assert an invariant.
        </p>
      </header>
      <div className={styles.grid}>
        {scenarios.map((scenario, index) => (
          <article
            className={styles.card}
            key={scenario.id}
            data-posture={scenario.posture}
          >
            <span className={styles.number}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span
              className={styles.posture}
              data-posture={scenario.posture}
            >
              {POSTURE_LABEL[scenario.posture]}
            </span>
            <h2>{scenario.title}</h2>
            <p>{scenario.summary}</p>
            <p className={styles.hint}>{POSTURE_HINT[scenario.posture]}</p>
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
