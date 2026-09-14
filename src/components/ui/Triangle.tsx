import styles from './Triangle.module.css';

export default function Triangle({
  direction,
}: {
  direction: 'up' | 'down' | 'flat';
}) {
  if (direction === 'flat') return null;
  return (
    <span
      className={direction === 'up' ? styles.up : styles.down}
      aria-hidden="true"
    />
  );
}
