import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './AppShell.module.css';
import ConnectionStatus from './ConnectionStatus';

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <header className={styles.topbar}>
        <Link href="/BTCUSDT" className={styles.brand}>
          <svg
            className={styles.logo}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <rect x="3" y="2" width="7" height="5" rx="1.5" fill="var(--ask)" />
            <rect x="3" y="9" width="10" height="5" rx="1.5" fill="var(--bid)" />
          </svg>
          Order Book
        </Link>
        <ConnectionStatus />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}
