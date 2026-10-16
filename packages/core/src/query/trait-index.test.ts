import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { indexTrait } from './indexed-trait';
import { createTraitIndex } from './trait-index';

function trait(id: string): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Afflicts a debuff.',
    material: 'Brute Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
  };
}

describe('createTraitIndex', () => {
  it('indexes every trait, in the order they were given', () => {
    const traits = [trait('c'), trait('a'), trait('b')];
    expect(createTraitIndex(traits).entries).toEqual(traits.map((each) => indexTrait(each)));
  });

  it('is empty for no traits', () => {
    expect(createTraitIndex([]).entries).toEqual([]);
  });
});
