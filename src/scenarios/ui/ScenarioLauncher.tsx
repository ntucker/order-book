'use client';

import { useRouter } from 'next/navigation';

import { POSTURE_LABEL } from '../shared/posture';
import type { ScenarioPosture } from '../shared/types';
import ScenarioDiagram from './ScenarioDiagram';
import styles from './ScenarioLauncher.module.css';

export default function ScenarioLauncher({
  scenarios,
}: {
  scenarios: {
    id: string;
    title: string;
    posture: ScenarioPosture;
    symbol: string;
  }[];
}) {
  const router = useRouter();
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>
          <a href="/BTCUSDT">Live book</a>
          <span aria-hidden="true"> · </span>
          Reactive Data Client laboratory
        </span>
        <h1>Deterministic order-book scenarios</h1>
        <ul className={styles.legend} aria-label="Diagram legend">
          <li data-kind="skeleton">░░░░ skeleton</li>
          <li data-kind="static">100.01 server</li>
          <li data-kind="live">100.05▲ live</li>
          <li data-kind="request">⟳ request</li>
          <li data-kind="blank">✗ never</li>
        </ul>
      </header>
      <div className={styles.grid} data-launcher-grid="">
        {scenarios.map((scenario, index) => (
          <article
            className={styles.card}
            key={scenario.id}
            data-posture={scenario.posture}
            data-scenario={scenario.id}
          >
            <div className={styles.meta}>
              <span className={styles.number}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span
                className={styles.posture}
                data-posture={scenario.posture}
              >
                {POSTURE_LABEL[scenario.posture]}
              </span>
            </div>
            <h2>{scenario.title}</h2>
            <ScenarioDiagram id={scenario.id} />
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
