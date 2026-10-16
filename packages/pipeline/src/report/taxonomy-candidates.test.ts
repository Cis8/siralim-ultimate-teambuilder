import type { KeywordHit, Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { findTaxonomyCandidates } from './taxonomy-candidates';

function trait(id: string, description: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: `Name of ${id}`,
    creature: `Creature of ${id}`,
    family: 'Family',
    class: 'Death',
    kind: 'creature',
    description,
    material: `Material of ${id}`,
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    ...overrides,
  };
}

/** A keyword hit over `word` in `description`. */
function hitOn(description: string, word: string): KeywordHit {
  const start = description.indexOf(word);
  return { key: word.toLowerCase(), kind: 'mechanic', span: [start, start + word.length] };
}

const termsOf = (traits: Trait[], options = {}) =>
  findTaxonomyCandidates(traits, { minTraits: 1, ...options }).map((candidate) => candidate.term);

describe('findTaxonomyCandidates', () => {
  it('finds a capitalised term in the middle of a sentence, once per trait, with the traits it is in', () => {
    const traits = [
      trait('a', 'This creature casts Fireball twice. Then Fireball again.'),
      trait('b', 'Your creatures cast Fireball.'),
      trait('c', 'No terms here.'),
    ];
    expect(findTaxonomyCandidates(traits, { minTraits: 1 })).toEqual([
      { term: 'Fireball', traits: 2, example: 'a', afterStatusCue: false },
    ]);
  });

  it('ignores the word a sentence starts with', () => {
    expect(termsOf([trait('a', 'Enemies take damage. Death - Enemies flee. After that, Wolves howl.')])).toEqual([
      'Wolves',
    ]);
  });

  it('joins consecutive capitalised words into one term', () => {
    expect(termsOf([trait('a', 'This creature gains Mega Magic and Long Live.')])).toEqual(['Long Live', 'Mega Magic']);
  });

  it('does not join words that something separates', () => {
    expect(termsOf([trait('a', 'It casts Fireball, Snowstorm and Lightning.')])).toEqual([
      'Fireball',
      'Lightning',
      'Snowstorm',
    ]);
  });

  it('drops the possessive', () => {
    expect(termsOf([trait('a', "It uses Mega Magic's power.")])).toEqual(['Mega Magic']);
  });

  describe('what is not a candidate', () => {
    it('is a word a keyword already covers', () => {
      const description = 'It gains Barrier and casts Fireball on Spell Gems.';
      const traits = [
        trait('a', description, { keywords: [hitOn(description, 'Barrier'), hitOn(description, 'Spell Gems')] }),
      ];
      expect(termsOf(traits)).toEqual(['Fireball']);
    });

    it('is the name of a trait, a creature, a family (whatever its plural) or a material', () => {
      const traits = [
        trait('a', 'Copies Long Live from Brute Stitches, the Abomination Brute and Imlings.', {
          name: 'Flesh Rot',
          creature: 'Abomination Brute',
          family: 'Imling',
          material: 'Brute Stitches',
        }),
        trait('b', 'Fine.', { name: 'Long Live' }),
      ];
      expect(termsOf(traits)).toEqual([]);
    });

    it('is a term that was reviewed and is no keyword', () => {
      const traits = [trait('a', 'Deals damage based on Health and Fireball.')];
      expect(termsOf(traits, { ignore: new Set(['Health']) })).toEqual(['Fireball']);
    });

    it('is a term in fewer traits than asked', () => {
      const traits = [
        trait('a', 'Casts Fireball and Snowstorm.'),
        trait('b', 'Casts Fireball.'),
        trait('c', 'Casts Fireball.'),
      ];
      expect(findTaxonomyCandidates(traits, { minTraits: 3 }).map((c) => c.term)).toEqual(['Fireball']);
    });
  });

  it('asks for three traits unless told otherwise', () => {
    const two = [trait('a', 'Casts Fireball.'), trait('b', 'Casts Fireball.')];
    expect(findTaxonomyCandidates(two)).toEqual([]);
    expect(findTaxonomyCandidates([...two, trait('c', 'Casts Fireball.')])).toHaveLength(1);
  });

  it('puts the most frequent first, then in alphabetical order', () => {
    const traits = [
      trait('a', 'Casts Zeal and Alpha and Beta.'),
      trait('b', 'Casts Zeal and Beta.'),
      trait('c', 'Casts Zeal.'),
    ];
    expect(termsOf(traits)).toEqual(['Zeal', 'Beta', 'Alpha']);
  });

  describe('a possible buff or debuff', () => {
    it.each([
      ['It is afflicted with Taunted.', true],
      ['It afflicts the target with Taunted.', true],
      ['It gains Taunted.', true],
      ['It gains a Taunted.', true],
      ['Your creatures always have Taunted.', true],
      ['It casts Taunted.', false],
    ])('is told by the words before it: %s', (description, afterStatusCue) => {
      expect(findTaxonomyCandidates([trait('a', description)], { minTraits: 1 })[0]?.afterStatusCue).toBe(
        afterStatusCue,
      );
    });

    it('is so if any mention follows such words', () => {
      const traits = [trait('a', 'It casts Taunted.'), trait('b', 'It gains Taunted.')];
      expect(findTaxonomyCandidates(traits, { minTraits: 1 })[0]?.afterStatusCue).toBe(true);
    });
  });
});
