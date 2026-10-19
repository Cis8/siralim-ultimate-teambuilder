import type { Alternative, KeywordHit, SameFamily, SameTrigger, Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import {
  LISTED_AT_MOST,
  PREVIEW_CARDS,
  relatedSections,
  shownCards,
  type RelatedCard,
  type RelatedLists,
} from './related-sections';

const trait = (id: string, overrides: Partial<Trait> = {}): Trait => ({
  id,
  name: id,
  creature: 'Brute',
  family: 'Abomination',
  class: 'Death',
  kind: 'creature',
  description: '',
  material: 'Ore',
  stacks: true,
  randomDebuff: null,
  masteryFamily: null,
  partyRequirement: null,
  keywords: [],
  conditionalSources: [],
  ...overrides,
});

const hit = (key: string, kind: KeywordHit['kind'], role: NonNullable<KeywordHit['role']>): KeywordHit => ({
  key,
  kind,
  role,
  span: [0, 1],
});

/** A focus that relies on Weak, applies Vulnerable and waits for an attack. */
const focus = trait('focus', {
  name: 'Focus',
  keywords: [hit('weak', 'debuff', 'uses'), hit('vulnerable', 'debuff', 'applies'), hit('attack', 'event', 'uses')],
});

const labelOf = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1);
const noTrigger: SameTrigger = { triggers: [], entries: [] };
const noFamily: SameFamily = { family: 'Abomination', grouping: false, entries: [] };

function sections(overrides: Partial<RelatedLists> = {}) {
  const found = relatedSections(
    {
      trait: focus,
      alternatives: [],
      sameTrigger: noTrigger,
      sameFamily: noFamily,
      artifactOnly: false,
      ...overrides,
    },
    labelOf,
  );
  const [alternatives, sameTrigger, sameFamily] = found;
  if (alternatives === undefined || sameTrigger === undefined || sameFamily === undefined) {
    throw new Error('the page has three sections');
  }
  return { found, alternatives, sameTrigger, sameFamily };
}

const alternative = (id: string, shared: Alternative['shared']): Alternative => ({ trait: trait(id), shared });

describe('the three lists under the sides of a trait', () => {
  it('are Alternatives, Same trigger and Same family, in that order (SPEC §8.4)', () => {
    const { found } = sections();

    expect(found.map(({ id, title }) => [id, title])).toEqual([
      ['alternatives', 'Alternatives'],
      ['same-trigger', 'Same trigger'],
      ['same-family', 'Same family'],
    ]);
  });
});

describe('Alternatives', () => {
  it('say what each shares with the focus, by what the trait does with it, in the order the focus names the keys', () => {
    const { alternatives } = sections({
      alternatives: [
        alternative('a', [
          { key: 'weak', role: 'uses' },
          { key: 'vulnerable', role: 'applies' },
          { key: 'burning', role: 'uses' },
        ]),
        alternative('b', [{ key: 'vulnerable', role: 'applies' }]),
      ],
    });

    expect(alternatives.cards.map(({ detail }) => detail)).toEqual([
      'Also applies Vulnerable · relies on Weak, Burning',
      'Also applies Vulnerable',
    ]);
  });

  it('tag a trait with the number of keys in common once it is more than one, as the lanes tag their links', () => {
    const { alternatives } = sections({
      alternatives: [
        alternative('two', [
          { key: 'weak', role: 'uses' },
          { key: 'vulnerable', role: 'applies' },
        ]),
        alternative('one', [{ key: 'weak', role: 'uses' }]),
      ],
    });

    expect(alternatives.cards.map(({ badge }) => badge)).toEqual(['×2 in common', undefined]);
  });

  it('keep the order core gave them and carry the trait itself', () => {
    const first = alternative('first', [{ key: 'weak', role: 'uses' }]);
    const second = alternative('second', [{ key: 'weak', role: 'uses' }]);

    expect(sections({ alternatives: [first, second] }).alternatives.cards.map(({ trait: card }) => card)).toEqual([
      first.trait,
      second.trait,
    ]);
  });

  it('are counted, with a sentence under the heading that names the focus', () => {
    const { alternatives } = sections();

    expect(alternatives.counted).toBe(true);
    expect(alternatives.hint).toBe('Traits that apply or rely on the same keys as Focus');
  });

  it('say, when nobody does, that nobody does, in the words of the filter', () => {
    expect(sections().alternatives.empty).toBe(
      'No other trait applies or relies on the same keys as Focus in the compendium.',
    );
    expect(sections({ artifactOnly: true }).alternatives.empty).toBe(
      'No other trait applies or relies on the same keys as Focus among artifact-eligible traits.',
    );
  });

  it('say instead that a focus with no key by name has nothing to compare, which no filter changes', () => {
    const bare = trait('bare', {
      name: 'Bare',
      keywords: [hit('attack', 'event', 'uses'), hit('weak', 'debuff', 'resists')],
    });
    const expected =
      'Bare applies and relies on no buff, debuff or effect by name, so nothing is listed as an alternative.';

    expect(sections({ trait: bare }).alternatives.empty).toBe(expected);
    expect(sections({ trait: bare, artifactOnly: true }).alternatives.empty).toBe(expected);
  });
});

describe('Same trigger', () => {
  const triggered: SameTrigger = {
    triggers: ['attack', 'start of battle'],
    entries: [
      { trait: trait('both'), shared: ['attack', 'start of battle'] },
      { trait: trait('attacker'), shared: ['attack'] },
    ],
  };

  it('name the events the focus waits for under the heading', () => {
    expect(sections({ sameTrigger: triggered }).sameTrigger.hint).toBe(
      'Traits that also react to Attack, Start of battle',
    );
  });

  it('say which of those events each trait waits for as well, and tag the ones that share more than one', () => {
    const { sameTrigger } = sections({ sameTrigger: triggered });

    expect(sameTrigger.cards.map(({ detail }) => detail)).toEqual([
      'Also reacts to Attack, Start of battle',
      'Also reacts to Attack',
    ]);
    expect(sameTrigger.cards.map(({ badge }) => badge)).toEqual(['×2 in common', undefined]);
  });

  it('say that a focus which waits for nothing has no trigger to share, and not that the compendium lacks a match', () => {
    const { sameTrigger } = sections({ sameTrigger: noTrigger });

    expect(sameTrigger.hint).toBe('Traits that react to the same events as Focus');
    expect(sameTrigger.empty).toBe('Focus reacts to no event, so no trait is listed with it.');
  });

  it('say, when the focus waits for something that nobody else does, that nobody does, in the words of the filter', () => {
    const lonely: SameTrigger = { triggers: ['attack'], entries: [] };

    expect(sections({ sameTrigger: lonely }).sameTrigger.empty).toBe(
      'No other trait reacts to the same events in the compendium.',
    );
    expect(sections({ sameTrigger: lonely, artifactOnly: true }).sameTrigger.empty).toBe(
      'No other trait reacts to the same events among artifact-eligible traits.',
    );
  });
});

describe('Same family', () => {
  const family: SameFamily = {
    family: 'Abomination',
    grouping: false,
    entries: [trait('mastery', { kind: 'mastery', creature: null }), trait('creature')],
  };

  it('lists the traits of the family as plain cards: where they come from says the rest', () => {
    const { sameFamily } = sections({ sameFamily: family });

    expect(sameFamily.counted).toBe(true);
    expect(sameFamily.hint).toBe('Other Abomination traits, the mastery first');
    expect(sameFamily.cards).toEqual<RelatedCard[]>(family.entries.map((card) => ({ trait: card })));
  });

  it('says, for a trait alone in its family, that nobody else is in it, in the words of the filter', () => {
    expect(sections({ sameFamily: noFamily }).sameFamily.empty).toBe(
      'No other trait of the Abomination family in the compendium.',
    );
    expect(sections({ sameFamily: noFamily, artifactOnly: true }).sameFamily.empty).toBe(
      'No other trait of the Abomination family among artifact-eligible traits.',
    );
  });

  it('lists nobody for a name that only groups traits, and says why instead of counting them (PLAN D36)', () => {
    const grouping: SameFamily = { family: 'Exotic', grouping: true, entries: [trait('one'), trait('two')] };
    const { sameFamily } = sections({ sameFamily: grouping });

    expect(sameFamily.cards).toEqual([]);
    expect(sameFamily.counted).toBe(false);
    expect(sameFamily.hint).toBe('Exotic is a grouping in the compendium, not a family');
    expect(sameFamily.empty).toBe('No mastery trait is named for it, so its traits are not listed together.');
  });
});

describe('what a section shows', () => {
  const cards = (count: number): RelatedCard[] =>
    Array.from({ length: count }, (_, at) => ({ trait: trait(`t${String(at)}`) }));

  it('is the first few cards at first', () => {
    const shown = shownCards(cards(40), false);

    expect(shown.cards).toHaveLength(PREVIEW_CARDS);
    expect(shown.cards.map(({ trait: card }) => card.id)).toEqual(['t0', 't1', 't2', 't3', 't4', 't5']);
    expect(shown.total).toBe(40);
    expect(shown.capped).toBe(false);
  });

  it('is every card once it is opened', () => {
    const shown = shownCards(cards(40), true);

    expect(shown.cards).toHaveLength(40);
    expect(shown.capped).toBe(false);
  });

  it('stops at the most the page lists, and says so, only once it is opened', () => {
    const many = cards(LISTED_AT_MOST + 1);

    expect(shownCards(many, true)).toMatchObject({ total: LISTED_AT_MOST + 1, capped: true });
    expect(shownCards(many, true).cards).toHaveLength(LISTED_AT_MOST);
    expect(shownCards(many, false).capped).toBe(false);
    expect(shownCards(cards(LISTED_AT_MOST), true).capped).toBe(false);
  });

  it('shows everything there is when there is not more than the first few', () => {
    expect(shownCards(cards(PREVIEW_CARDS), false).cards).toHaveLength(PREVIEW_CARDS);
    expect(shownCards(cards(2), false).cards).toHaveLength(2);
    expect(shownCards([], true)).toEqual({ cards: [], total: 0, capped: false });
  });
});
