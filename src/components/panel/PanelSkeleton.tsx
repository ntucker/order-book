import Panel from './Panel';
import styles from './PanelSkeleton.module.css';

export type SkeletonKind = 'book' | 'trades' | 'chart' | 'ticker' | 'watch';

export default function PanelSkeleton({
  kind,
  title = 'Loading',
}: {
  kind: SkeletonKind;
  title?: string;
}) {
  if (kind === 'chart') {
    return (
      <Panel title={title}>
        <div className={styles.wrap}>
          <div className={styles.chart} />
        </div>
      </Panel>
    );
  }

  if (kind === 'ticker') {
    return (
      <Panel title={title}>
        <div className={styles.row} style={{ height: 72, padding: '0 16px' }}>
          <span className={styles.bar} />
          <span className={styles.bar} />
          <span className={styles.bar} />
        </div>
      </Panel>
    );
  }

  const rows = kind === 'watch' ? 8 : 16;
  return (
    <Panel title={title}>
      <div className={styles.wrap}>
        {kind !== 'watch' ? (
          <div className={styles.columns}>
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </div>
        ) : null}
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className={styles.row}>
            <span className={styles.bar} />
            <span className={styles.bar} />
            <span className={styles.bar} />
          </div>
        ))}
      </div>
    </Panel>
  );
}
