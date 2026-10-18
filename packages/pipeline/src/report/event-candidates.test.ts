import type { KeywordHit, Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { findEventCandidates } from './event-candidates';

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
    conditionalSources: [],
    keywords: [],
    ...overrides,
  };
}

/** A keyword hit over the first `word` in `description`. */
function hitOn(description: string, word: string): KeywordHit {
  const start = description.indexOf(word);
  return { key: word.toLowerCase(), kind: 'event', span: [start, start + word.length] };
}

const ONE_TRAIT = { minTraits: 1 };
const clausesOf = (traits: Trait[], extra = {}) =>
  findEventCandidates(traits, { ...ONE_TRAIT, ...extra }).clauses.map((candidate) => candidate.form);
const wordsOf = (traits: Trait[], extra = {}) =>
  findEventCandidates(traits, { ...ONE_TRAIT, ...extra }).words.map((candidate) => candidate.form);

describe('findEventCandidates', () => {
  describe('conditions that no keyword covers', () => {
    it('finds the clause an opening word starts, once per trait, with the traits it is in and the first', () => {
      const traits = [
        trait(
          'a',
          'While this creature is above 50% health, it grows. While this creature is above 75% health, it howls.',
        ),
        trait('b', 'While this creature is above 25% health, it heals.'),
        trait('c', 'Nothing here.'),
      ];
      expect(findEventCandidates(traits, ONE_TRAIT).clauses).toEqual([
        { form: 'while this creature is above # health', traits: 2, example: 'a' },
      ]);
    });

    it.each(['After', 'When', 'Whenever', 'If', 'While', 'At', 'Each time', 'Once', 'Before', 'Upon', 'As long as'])(
      'starts with %s',
      (opener) => {
        expect(clausesOf([trait('a', `${opener} the moon rises, it howls.`)])).toEqual([
          `${opener.toLowerCase()} the moon rises`,
        ]);
      },
    );

    it('finds a clause that opens a later sentence, and ends at the comma or the full stop', () => {
      const description = 'It howls. If the moon rises and sets. It sleeps, when it dreams, it howls.';
      expect(clausesOf([trait('a', description)])).toEqual(['if the moon rises and sets']);
    });

    it('leaves out a clause a keyword is in, wherever in it', () => {
      const description = 'After an enemy attacks, it howls. When the moon rises, it sleeps.';
      const traits = [trait('a', description, { keywords: [hitOn(description, 'attacks')] })];
      expect(clausesOf(traits)).toEqual(['when the moon rises']);
    });

    it('keeps a clause that has a keyword only somewhere else in the description', () => {
      const description = 'When the moon rises, it sleeps and casts.';
      const traits = [trait('a', description, { keywords: [hitOn(description, 'casts')] })];
      expect(clausesOf(traits)).toEqual(['when the moon rises']);
    });

    it('writes any family, singular or plural, as <family>, so that one condition is one form', () => {
      const traits = [
        trait('a', 'If all the creatures in your party are Abominations, it howls.', { family: 'Abomination' }),
        trait('b', 'If all the creatures in your party are Pit Worms, it howls.', { family: 'Pit Worm' }),
        trait('c', 'If all the creatures in your party are Mummies, it howls.', { family: 'Mummy' }),
      ];
      expect(findEventCandidates(traits, ONE_TRAIT).clauses).toEqual([
        { form: 'if all the creatures in your party are <family>', traits: 3, example: 'a' },
      ]);
    });

    it('takes a family only as a whole word', () => {
      const traits = [trait('a', 'If an Eftover rises, it howls.', { family: 'Eft' })];
      expect(clausesOf(traits)).toEqual(['if an eftover rises']);
    });
  });

  describe('words of an event that no keyword covers', () => {
    it('finds the phrase around the word, from the comma before to the comma after, with numbers as #', () => {
      const traits = [
        trait('a', 'After this creature kills a creature, it gains 5 random buffs. It sleeps.'),
        trait('b', 'Your creatures gain 3 random buffs.'),
      ];
      expect(findEventCandidates(traits, ONE_TRAIT).words).toEqual([
        { form: 'it gains # random buffs', traits: 1, example: 'a' },
        { form: 'your creatures gain # random buffs', traits: 1, example: 'b' },
      ]);
    });

    it.each([
      ['attack', 'This creature attacks twice.', 'this creature attacks twice'],
      ['provoke', 'This creature provokes twice.', 'this creature provokes twice'],
      ['defend', 'This creature defends twice.', 'this creature defends twice'],
      ['dodge', 'This creature dodges twice.', 'this creature dodges twice'],
      ['heal', 'This creature heals twice.', 'this creature heals twice'],
      ['recover', 'This creature recovers 100% health.', 'this creature recovers # health'],
      ['die', 'This creature dies twice.', 'this creature dies twice'],
      ['kill', 'This creature kills twice.', 'this creature kills twice'],
      ['resurrect', 'This creature resurrects twice.', 'this creature resurrects twice'],
      ['cast', 'This creature casts twice.', 'this creature casts twice'],
      ['take damage', 'This creature takes extra damage.', 'this creature takes extra damage'],
      ['take damage, past', 'This creature took damage.', 'this creature took damage'],
      ['a turn', "Once per battle, at the start of the moon's turn.", "at the start of the moon's turn"],
      ['gain a buff', 'It gains a buff.', 'it gains a buff'],
      ['be afflicted', 'It is afflicted with 3 random debuffs.', 'it is afflicted with # random debuffs'],
    ])('knows %s', (_event, description, form) => {
      expect(wordsOf([trait('a', description)])).toEqual([form]);
    });

    it('leaves out a word a keyword covers', () => {
      const description = 'This creature attacks twice, and heals.';
      const traits = [trait('a', description, { keywords: [hitOn(description, 'attacks')] })];
      expect(wordsOf(traits)).toEqual(['and heals']);
    });

    it('leaves out "attack" where it is a stat', () => {
      expect(wordsOf([trait('a', 'This creature has 50% more attack and speed.')])).toEqual([]);
    });

    it.each(['Your creatures gain Major Healing.', 'Your creatures have a Chance to Provoke.'])(
      'leaves out a word that is part of a name, which a capital in mid-sentence shows: %s',
      (description) => {
        expect(wordsOf([trait('a', description)])).toEqual([]);
      },
    );

    it('keeps a word that a capital opens the sentence with', () => {
      expect(wordsOf([trait('a', 'It howls. Attacks twice.')])).toEqual(['attacks twice']);
    });

    it('leaves out a word inside a condition, which the condition already lists', () => {
      const traits = [trait('a', 'When this creature would take fatal damage, it survives.')];
      expect(clausesOf(traits)).toEqual(['when this creature would take fatal damage']);
      expect(wordsOf(traits)).toEqual([]);
    });

    it('lists a phrase once per trait however many words it has', () => {
      expect(findEventCandidates([trait('a', 'It heals and heals twice.')], ONE_TRAIT).words).toEqual([
        { form: 'it heals and heals twice', traits: 1, example: 'a' },
      ]);
    });
  });

  describe.each([
    { name: 'condition', formsOf: clausesOf, text: (what: string) => `If ${what} rises, it sleeps.` },
    { name: 'phrase', formsOf: wordsOf, text: (what: string) => `It heals ${what}.` },
  ])('a $name', ({ formsOf, text }) => {
    const moon = trait('moon', text('moon'));
    const sun = trait('sun', text('sun'));
    const ash = trait('ash', text('ash'));

    it('is left out when it was reviewed and is no event', () => {
      expect(formsOf([moon, sun], { ignore: new Set(formsOf([moon])) })).toEqual(formsOf([sun]));
    });

    it('is left out when in fewer traits than asked', () => {
      expect(formsOf([moon, sun, trait('sun-2', text('sun'))], { minTraits: 2 })).toEqual(formsOf([sun]));
    });

    it('comes the most frequent first, then in alphabetical order', () => {
      const traits = [moon, sun, trait('sun-2', text('sun')), ash, trait('ash-2', text('ash'))];
      expect(formsOf(traits)).toEqual([...formsOf([ash]), ...formsOf([sun]), ...formsOf([moon])]);
    });
  });

  it('asks for a single trait unless told otherwise', () => {
    expect(findEventCandidates([trait('a', 'If the moon rises, it sleeps.')]).clauses).toHaveLength(1);
  });

  it('finds nothing in a description without either', () => {
    expect(findEventCandidates([trait('a', 'This creature has 5% more speed.')])).toEqual({ clauses: [], words: [] });
  });
});
