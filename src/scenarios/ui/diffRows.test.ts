import { describe, expect, it } from 'vitest';

import type { ScenarioEvent } from '../shared/types';
import { diffTableRows } from './diffRows';

function event(
  id: string,
  overrides: Partial<ScenarioEvent> = {},
): ScenarioEvent {
  return {
    id,
    milestoneId: 'markets-visible',
    sequence: 1,
    phase: 'client',
    kind: 'store-committed',
    source: 'getSymbolInfo',
    summary: '1 entities · 1 endpoints',
    entityDiffs: [
      {
        entityKey: 'SymbolInfo',
        pk: 'BTCUSDT',
        change: 'added',
        changedFields: [{ path: [], after: { symbol: 'BTCUSDT' } }],
      },
    ],
    endpointDiffs: [
      {
        endpointKey:
          'GET https://data-api.binance.vision/api/v3/exchangeInfo?symbol=BTCUSDT',
        result: { path: [], after: { symbol: 'BTCUSDT' } },
        meta: [{ path: [], after: { date: 1 } }],
      },
    ],
    occurrenceIds: [],
    ...overrides,
  };
}

describe('diff table rows', () => {
  it('keeps a unique key when several commits touch the same record', () => {
    const rows = diffTableRows([
      event('run:client:1'),
      event('run:client:2', {
        entityDiffs: [
          {
            entityKey: 'SymbolInfo',
            pk: 'BTCUSDT',
            change: 'updated',
            changedFields: [
              { path: ['tickSize'], before: '0.01', after: '0.01' },
            ],
          },
        ],
        endpointDiffs: [],
      }),
    ]);

    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(rows.map((row) => row.label)).toEqual([
      'SymbolInfo:BTCUSDT · added',
      'GET https://data-api.binance.vision/api/v3/exchangeInfo?symbol=BTCUSDT · result',
      'GET https://data-api.binance.vision/api/v3/exchangeInfo?symbol=BTCUSDT · meta.',
      'SymbolInfo:BTCUSDT · tickSize',
    ]);
  });
});
