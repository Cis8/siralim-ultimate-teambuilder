import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Trait } from '../model/trait';
import { fieldRegistry } from './fields';
import { createQueryVocabulary } from './query-vocabulary';
import { createTraitIndex } from './trait-index';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
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

const vocabularyOf = (traits: readonly Trait[]) => createQueryVocabulary(createTraitIndex(traits));

describe('createQueryVocabulary', () => {
  it('lists the distinct classes, families, creatures and trait names of the dataset', () => {
    const vocabulary = vocabularyOf([
      trait('Bite', { class: 'Death', family: 'Wolf', creature: 'Dire Wolf' }),
      trait('Howl', { class: 'Nature', family: 'Wolf', creature: 'Dire Wolf' }),
      trait('Gnaw', { class: 'Death', family: 'Rat', creature: 'Plague Rat' }),
    ]);

    expect(vocabulary).toEqual({
      class: ['Death', 'Nature'],
      family: ['Rat', 'Wolf'],
      creature: ['Dire Wolf', 'Plague Rat'],
      name: ['Bite', 'Gnaw', 'Howl'],
    });
  });

  it('lists the entries from A to Z whatever the letter case, whatever the order of the dataset', () => {
    const vocabulary = vocabularyOf([
      trait('b', { family: 'of the Beast' }),
      trait('c', { family: 'Offering' }),
      trait('a', { family: 'Of Old' }),
      trait('d', { family: 'Zombie' }),
    ]);

    expect(vocabulary.family).toEqual(['Of Old', 'of the Beast', 'Offering', 'Zombie']);
  });

  it('lists an entry once however the traits spell its letter case, as the first of them does', () => {
    const vocabulary = vocabularyOf([
      trait('a', { class: 'Nether Boss' }),
      trait('b', { class: 'NETHER BOSS' }),
      trait('c', { class: 'nether boss' }),
    ]);

    expect(vocabulary.class).toEqual(['Nether Boss']);
  });

  it('lists no entry for a trait that has no creature', () => {
    const vocabulary = vocabularyOf([trait('mastery', { creature: null, kind: 'mastery' })]);

    expect(vocabulary.creature).toEqual([]);
    expect(vocabulary.name).toEqual(['mastery']);
  });

  it('has empty lists for an empty dataset', () => {
    expect(vocabularyOf([])).toEqual({ class: [], family: [], creature: [], name: [] });
  });

  it('has a list for every column that a field takes its values from', () => {
    const vocabulary = vocabularyOf([trait('a')]);
    const columns = fieldRegistry.fields.flatMap(({ values }) =>
      values?.kind === 'vocabulary' ? [values.column] : [],
    );

    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) expect(vocabulary[column], column).toEqual(expect.any(Array));
  });

  it('is sorted and has no repeat, whichever traits the dataset holds', () => {
    const spellings = ['Life', 'life', 'Death', 'Nature', 'Boss', 'death'];
    const traits = spellings.map((spelling, at) => trait(`t${at}`, { class: spelling, family: spelling }));

    fc.assert(
      fc.property(fc.shuffledSubarray(traits, { minLength: 1 }), (given) => {
        const lowerCase = (entries: readonly string[]) => entries.map((entry) => entry.toLowerCase());
        const { class: classes, family } = vocabularyOf(given);

        expect(lowerCase(classes)).toEqual(lowerCase(classes).toSorted());
        expect(lowerCase(classes)).toEqual([...new Set(lowerCase(classes))]);
        expect(lowerCase(family)).toEqual(lowerCase(classes));
      }),
    );
  });
});
