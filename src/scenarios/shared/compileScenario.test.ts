import { describe, expect, it } from 'vitest';

import { streamedRevealScenario } from '../definitions/streamed-reveal';
import { compileScenario } from './compileScenario';

describe('compileScenario', () => {
  it('assigns monotonic cursors and gate ownership', () => {
    const compiled = compileScenario(streamedRevealScenario);
    expect(compiled.milestones.map((milestone) => milestone.cursor)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(compiled.gateOwners['response:book']).toBe('book-visible');
    expect(compiled.gateOwners['panel:ticker']).toBe('markets-visible');
  });

  it('rejects duplicate milestone ids', () => {
    expect(() =>
      compileScenario({
        ...streamedRevealScenario,
        milestones: [
          streamedRevealScenario.milestones[0],
          streamedRevealScenario.milestones[0],
        ],
      }),
    ).toThrow('Duplicate milestone');
  });

  it('rejects a gate owned by two milestones', () => {
    const [first, second] = streamedRevealScenario.milestones;
    expect(() =>
      compileScenario({
        ...streamedRevealScenario,
        milestones: [
          first,
          {
            ...second,
            releases: [
              ...second.releases,
              { kind: 'panel' as const, gateId: 'panel:ticker' },
            ],
          },
        ],
      }),
    ).toThrow('owned by both');
  });

  it('rejects unknown stream events', () => {
    expect(() =>
      compileScenario({
        ...streamedRevealScenario,
        milestones: [
          {
            ...streamedRevealScenario.milestones[0],
            releases: [{ kind: 'stream', eventId: 'missing' }],
          },
        ],
      }),
    ).toThrow('unknown stream event');
  });
});
