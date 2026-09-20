import type { State } from '@data-client/react';
import { describe, expect, it } from 'vitest';

import { diffEndpoints, diffEntities } from './diffState';

function state(
  overrides: Partial<State<unknown>> = {},
): State<unknown> {
  return {
    entities: {},
    endpoints: {},
    indexes: {},
    meta: {},
    entitiesMeta: {},
    optimistic: [],
    lastReset: 0,
    ...overrides,
  };
}

describe('store diffs', () => {
  it('reports added, updated, and removed entities by normalized identity', () => {
    const before = state({
      entities: {
        Ticker: {
          BTCUSDT: { symbol: 'BTCUSDT', lastPrice: 100 },
          OLD: { symbol: 'OLD', lastPrice: 1 },
        },
      },
    });
    const after = state({
      entities: {
        Ticker: {
          BTCUSDT: { symbol: 'BTCUSDT', lastPrice: 100.05 },
          ETHUSDT: { symbol: 'ETHUSDT', lastPrice: 32 },
        },
      },
    });

    expect(diffEntities(before, after)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityKey: 'Ticker',
          pk: 'BTCUSDT',
          change: 'updated',
        }),
        expect.objectContaining({ pk: 'OLD', change: 'removed' }),
        expect.objectContaining({ pk: 'ETHUSDT', change: 'added' }),
      ]),
    );
  });

  it('separates endpoint result and metadata changes', () => {
    const before = state({
      endpoints: { 'GET /ticker': 'BTCUSDT' },
      meta: {
        'GET /ticker': { date: 1, fetchedAt: 1, expiresAt: 10 },
      },
    });
    const after = state({
      endpoints: { 'GET /ticker': 'ETHUSDT' },
      meta: {
        'GET /ticker': { date: 2, fetchedAt: 2, expiresAt: 20 },
      },
    });
    const [diff] = diffEndpoints(before, after);
    expect(diff.endpointKey).toBe('GET /ticker');
    expect(diff.result).toMatchObject({
      before: 'BTCUSDT',
      after: 'ETHUSDT',
    });
    expect(diff.meta).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['date'], before: 1, after: 2 }),
      ]),
    );
  });
});
