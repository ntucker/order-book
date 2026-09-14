'use client';

import { useSyncExternalStore } from 'react';

import {
  getConnectionStatus,
  subscribeConnection,
} from '@/resources/connectionStore';

import styles from './AppShell.module.css';

const LABELS = {
  open: 'Live',
  connecting: 'Connecting',
  reconnecting: 'Reconnecting',
  closed: 'Offline',
} as const;

export default function ConnectionStatus() {
  const status = useSyncExternalStore(
    subscribeConnection,
    getConnectionStatus,
    () => 'connecting' as const,
  );
  const dot =
    status === 'open'
      ? styles.live
      : status === 'reconnecting'
        ? styles.warn
        : styles.dot;

  return (
    <div className={styles.pill} aria-live="polite">
      <span className={`${styles.dot} ${dot}`} />
      {LABELS[status]}
    </div>
  );
}
