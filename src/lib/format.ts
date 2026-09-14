const formatters = new Map<number, Intl.NumberFormat>();

const compactFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

const percentFormat = new Intl.NumberFormat('en-US', {
  signDisplay: 'exceptZero',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

export function decimalsFromStep(step: string): number {
  const trimmed = step.replace(/0+$/, '');
  const dot = trimmed.indexOf('.');
  return dot === -1 ? 0 : trimmed.length - dot - 1;
}

export function formatNumber(value: number, decimals: number): string {
  let formatter = formatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(decimals, formatter);
  }
  return formatter.format(value);
}

export function formatCompact(value: number): string {
  return compactFormat.format(value);
}

export function formatSignedPercent(value: number): string {
  return `${percentFormat.format(value)}%`;
}

export function formatTime(ms: number): string {
  return timeFormat.format(ms);
}

export function formatBps(value: number): string {
  return `${value.toFixed(2)} bps`;
}

export function formatTick(tick: number): string {
  if (tick >= 1) return tick.toLocaleString('en-US', { maximumFractionDigits: 0 });
  const decimals = decimalsFromStep(tick.toFixed(12));
  return tick.toFixed(decimals);
}
