import { Entity } from '@data-client/rest';

export type ConnectionStatus =
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed';

export class Connection extends Entity {
  id = 'binance';
  status: ConnectionStatus = 'closed';
  since = 0;

  pk(): string {
    return this.id;
  }

  static key = 'Connection';
}

export const BINANCE_CONNECTION = { id: 'binance' } as const;
