import styles from './PanelError.module.css';

function isRateLimited(error: Error) {
  return 'status' in error && error.status === 429;
}

export default function PanelError({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  const limited = isRateLimited(error);
  return (
    <div className={styles.box} role="alert">
      <p className={styles.title}>
        {limited ? 'Binance rate limit' : "Couldn't load this panel"}
      </p>
      <p className={styles.detail}>
        {limited ?
          'Too many REST snapshots from this IP. Wait about 30 seconds, then retry.'
        : error.message}
      </p>
      <button type="button" className={styles.retry} onClick={resetErrorBoundary}>
        Retry
      </button>
    </div>
  );
}
