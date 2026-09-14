import type { ConnectionStatus } from './Connection';

let status: ConnectionStatus = 'connecting';
const listeners = new Set<() => void>();

export function getConnectionStatus() {
  return status;
}

export function setConnectionStatus(next: ConnectionStatus) {
  status = next;
  for (const listener of listeners) listener();
}

export function subscribeConnection(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
