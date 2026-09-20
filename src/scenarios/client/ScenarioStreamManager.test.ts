import { describe, expect, it } from 'vitest';

import { updateLevels } from './ScenarioStreamManager';

describe('updateLevels', () => {
  it('keeps bids descending while applying inserts and removals', () => {
    expect(
      updateLevels(
        [
          [100, 1],
          [99, 2],
        ],
        [
          ['101', '3'],
          ['100', '0'],
        ],
        'bid',
      ),
    ).toEqual([
      [101, 3],
      [99, 2],
    ]);
  });

  it('keeps asks ascending while applying inserts and removals', () => {
    expect(
      updateLevels(
        [
          [101, 1],
          [102, 2],
        ],
        [
          ['100.5', '3'],
          ['101', '0'],
        ],
        'ask',
      ),
    ).toEqual([
      [100.5, 3],
      [102, 2],
    ]);
  });
});
