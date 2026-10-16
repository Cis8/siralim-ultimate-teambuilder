import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { SORT_KEYS } from './explore-state';
import { sortTraits } from './sort-traits';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: '',
    material: null,
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const ids = (traits: readonly Trait[]): string[] => traits.map(({ id }) => id);

describe('sortTraits', () => {
  const a = trait('a', { name: 'Quell', class: 'Sorcery', family: 'Zeta' });
  const b = trait('b', { name: 'Frailty', class: 'Death', family: 'Abomination' });
  const c = trait('c', { name: 'Wretchedness', class: 'Death', family: 'Abomination' });
  const d = trait('d', { name: 'Hopelessness', class: 'Chaos', family: 'Zeta' });
  const e = trait('e', { name: 'bleak', class: 'Death', family: 'Alpha' });
  const traits = [a, b, c, d, e];

  it('knows a strategy for every sort key', () => {
    for (const key of SORT_KEYS) {
      expect(ids(sortTraits(traits, key)).toSorted(), key).toEqual(['a', 'b', 'c', 'd', 'e']);
    }
  });

  it('keeps the order the traits come in for book', () => {
    expect(ids(sortTraits(traits, 'book'))).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('orders by class, then family, and keeps the given order for traits that tie', () => {
    expect(ids(sortTraits(traits, 'class'))).toEqual(['d', 'b', 'c', 'e', 'a']);
    expect(ids(sortTraits([c, b], 'class'))).toEqual(['c', 'b']);
  });

  it('orders by trait name, whatever the letter case', () => {
    expect(ids(sortTraits(traits, 'az'))).toEqual(['e', 'b', 'd', 'a', 'c']);
  });

  it('breaks a tie between names that differ only in case the same way whatever the order given', () => {
    const upper = trait('upper', { name: 'Weak' });
    const lower = trait('lower', { name: 'weak' });

    expect(ids(sortTraits([upper, lower], 'az'))).toEqual(ids(sortTraits([lower, upper], 'az')));
  });

  it('does not change the traits it was given', () => {
    const given = [...traits];

    sortTraits(given, 'az');
    sortTraits(given, 'class');

    expect(ids(given)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('sorts no traits', () => {
    for (const key of SORT_KEYS) expect(sortTraits([], key)).toEqual([]);
  });
});
