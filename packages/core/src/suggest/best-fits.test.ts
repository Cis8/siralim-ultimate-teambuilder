import { describe, expect, it } from 'vitest';
import { bestFits } from './best-fits';
import { MAX_SUGGESTIONS } from './rank-candidates';

const same = (entry: string): string => entry;

describe('bestFits', () => {
  it('gives the entries that fit with the place they fit at, the better places first', () => {
    expect(bestFits(['unwell', 'being attacked', 'attack', 'nothing', 'attacker'], 'att', same)).toEqual([
      { entry: 'attack', tier: 'prefix' },
      { entry: 'attacker', tier: 'prefix' },
      { entry: 'being attacked', tier: 'word-start' },
    ]);
    expect(bestFits(['ratatouille', 'at'], 'at', same)).toEqual([
      { entry: 'at', tier: 'prefix' },
      { entry: 'ratatouille', tier: 'substring' },
    ]);
  });

  it('keeps the order of the entries inside a place', () => {
    expect(bestFits(['b-x', 'a-x', 'c-x'], 'x', same).map(({ entry }) => entry)).toEqual(['b-x', 'a-x', 'c-x']);
  });

  it('gives all of a short list for nothing typed', () => {
    expect(bestFits(['yes', 'no'], '', same).map(({ entry }) => entry)).toEqual(['yes', 'no']);
  });

  it('asks the text of an entry the way the caller says, and gives the entry itself', () => {
    const entries = [{ name: 'Life' }, { name: 'Death' }];

    expect(bestFits(entries, 'li', ({ name }) => name.toLowerCase())).toEqual([
      { entry: { name: 'Life' }, tier: 'prefix' },
    ]);
  });

  it('keeps no more of a place than the ranking could list, so that a long list is not all written out', () => {
    const many = Array.from({ length: 1780 }, (_, at) => `trait ${at}`);
    const fits = bestFits(many, 'trait', same);

    expect(fits).toHaveLength(MAX_SUGGESTIONS);
    expect(fits.map(({ entry }) => entry)).toEqual(many.slice(0, MAX_SUGGESTIONS));
  });

  it('keeps that many of each place, and finds a better place that comes late in the list', () => {
    const entries = [
      ...Array.from({ length: 12 }, (_, at) => `apple ${at}`),
      ...Array.from({ length: 12 }, (_, at) => `a pod ${at}`),
      'pear',
    ];
    const fits = bestFits(entries, 'p', same);

    expect(fits.filter(({ tier }) => tier === 'prefix').map(({ entry }) => entry)).toEqual(['pear']);
    expect(fits.filter(({ tier }) => tier === 'word-start')).toHaveLength(MAX_SUGGESTIONS);
    expect(fits.filter(({ tier }) => tier === 'substring')).toHaveLength(MAX_SUGGESTIONS);
  });

  it('gives nothing when nothing fits, and for no entries', () => {
    expect(bestFits(['one', 'two'], 'zz', same)).toEqual([]);
    expect(bestFits([], 'a', same)).toEqual([]);
  });
});
