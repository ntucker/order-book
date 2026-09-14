import type { ReactNode } from 'react';

import styles from './Panel.module.css';

export default function Panel({
  title,
  meta,
  controls,
  children,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className ?? ''}`}>
      <header className={styles.header}>
        <h2 className={styles.title}>
          {title}
          {meta ? <span className={styles.meta}> · {meta}</span> : null}
        </h2>
        {controls ? <div className={styles.controls}>{controls}</div> : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
