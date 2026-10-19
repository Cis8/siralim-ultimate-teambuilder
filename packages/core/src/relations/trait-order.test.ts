import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { compareByOverlap, compareTraitsByName } from './trait-order';

const named = (id: string, name: string) => ({ id, name }) as Trait;

describe('compareTraitsByName', () => {
  it('orders by name regardless of case, then by the exact name, then by id', () => {
    const traits = [
      named('i1', 'b'),
      named('i2', 'a'),
      named('i3', 'A'),
      named('z-same', 'Same'),
      named('a-same', 'Same'),
    ];

    expect(traits.toSorted(compareTraitsByName).map(({ id }) => id)).toEqual(['i3', 'i2', 'i1', 'a-same', 'z-same']);
  });

  it('is zero only for the same name and the same id', () => {
    expect(compareTraitsByName(named('x', 'Same'), named('x', 'Same'))).toBe(0);
    expect(compareTraitsByName(named('x', 'Same'), named('y', 'Same'))).toBeLessThan(0);
  });
});

describe('compareByOverlap', () => {
  const sharing = (id: string, name: string, shared: number) => ({
    trait: named(id, name),
    shared: Array.from({ length: shared }, () => 'key'),
  });

  it('puts the trait with more in common first, whatever its name', () => {
    const list = [sharing('a', 'Aardvark', 1), sharing('z', 'Zebra', 3), sharing('m', 'Mole', 2)];

    expect(list.toSorted(compareByOverlap).map(({ trait }) => trait.id)).toEqual(['z', 'm', 'a']);
  });

  it('orders traits with as much in common by name, as compareTraitsByName does', () => {
    const list = [sharing('i1', 'b', 2), sharing('i2', 'A', 2), sharing('i3', 'a', 2)];

    expect(list.toSorted(compareByOverlap).map(({ trait }) => trait.id)).toEqual(['i2', 'i3', 'i1']);
  });
});
