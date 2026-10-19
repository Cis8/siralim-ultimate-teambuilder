import type { KeywordView, Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { FOLD_ABOVE } from './lane-groups';
import { keywordSections } from './keyword-sections';

const trait = (id: string): Trait => ({
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
});

const many = (prefix: string, count: number): Trait[] =>
  Array.from({ length: count }, (_, at) => trait(`${prefix}-${String(at + 1)}`));

function viewOf(lists: Partial<Pick<KeywordView, 'appliers' | 'conditional' | 'random' | 'users'>> = {}): KeywordView {
  const { appliers = [], conditional = [], random = [], users = [] } = lists;
  return {
    key: 'weak',
    appliers,
    conditional,
    random,
    users,
    stats: { appliers: appliers.length, conditional: conditional.length, random: random.length, users: users.length },
    verdict: 'supported',
    coApplied: [],
  };
}

function sectionsOf(view: KeywordView, artifactOnly = false) {
  const [appliers, users] = keywordSections(view, 'Weak', artifactOnly);
  return { appliers, users };
}

const idsOf = (cards: readonly { trait: Trait }[]): string[] => cards.map(({ trait: card }) => card.id);

describe('the two lists of a keyword', () => {
  it('are Appliers and Rely on it, in that order, each with a sentence that names the keyword', () => {
    const { appliers, users } = sectionsOf(viewOf({ appliers: many('a', 2), users: many('u', 3) }));

    expect([appliers.id, users.id]).toEqual(['appliers', 'users']);
    expect([appliers.title, users.title]).toEqual(['Appliers', 'Rely on it']);
    expect(appliers.hint).toBe('Traits that apply Weak by name');
    expect(users.hint).toBe('Traits that rely on Weak being there');
    expect(appliers.counted && users.counted).toBe(true);
  });

  it('hold the traits the view lists, in the order it ranks them', () => {
    const { appliers, users } = sectionsOf(viewOf({ appliers: many('a', 4), users: many('u', 2) }));

    expect(idsOf(appliers.cards)).toEqual(['a-1', 'a-2', 'a-3', 'a-4']);
    expect(idsOf(users.cards)).toEqual(['u-1', 'u-2']);
    expect(appliers.cards.every(({ tier }) => tier === undefined)).toBe(true);
  });

  it('count only the traits that apply it by name: a conditional or random source is a group of its own', () => {
    const { appliers } = sectionsOf(
      viewOf({ appliers: many('a', 2), conditional: many('c', 1), random: many('r', 27) }),
    );

    expect(appliers.cards).toHaveLength(2);
    expect(appliers.groups?.map(({ id }) => id)).toEqual(['conditional', 'random']);
  });
});

describe('the groups under Appliers', () => {
  it('say how the traits give the key, each card tagged with it, the conditional ones before the random ones', () => {
    const { appliers } = sectionsOf(
      viewOf({ appliers: many('a', 1), conditional: many('c', 2), random: many('r', 2) }),
    );
    const [conditional, random] = appliers.groups ?? [];

    expect(conditional?.title).toBe('Under a condition · 2');
    expect(conditional?.hint).toBe('They give it once the other debuff of their pair is there.');
    expect(conditional?.cards.map(({ tier }) => tier)).toEqual(['conditional', 'conditional']);
    expect(random?.title).toBe('Random sources · 2');
    expect(random?.hint).toBe('They afflict a random debuff on enemies, so this one is not certain.');
    expect(idsOf(random?.cards ?? [])).toEqual(['r-1', 'r-2']);
    expect(random?.cards.map(({ tier }) => tier)).toEqual(['random', 'random']);
  });

  it('are folded behind a button once they list more than a few traits, as the lanes’ random sources are', () => {
    const folded = (count: number) =>
      sectionsOf(viewOf({ appliers: many('a', 1), random: many('r', count) })).appliers.groups?.[0]?.folded;

    expect(folded(FOLD_ABOVE)).toBe(false);
    expect(folded(FOLD_ABOVE + 1)).toBe(true);
    expect(folded(27)).toBe(true);
  });

  it('are left out when no trait gives the key that way, and the users have none', () => {
    const { appliers, users } = sectionsOf(viewOf({ appliers: many('a', 3), users: many('u', 3) }));

    expect(appliers.groups ?? []).toEqual([]);
    expect(users.groups ?? []).toEqual([]);
  });
});

describe('a list with nothing in it', () => {
  it('says that no trait applies the key, and that nothing relies on it yet, in the words of the filter', () => {
    const none = sectionsOf(viewOf());
    const filtered = sectionsOf(viewOf(), true);

    expect(none.appliers.empty).toBe('No trait applies Weak in the compendium.');
    expect(none.users.empty).toBe('Nothing relies on Weak yet in the compendium.');
    expect(filtered.appliers.empty).toBe('No trait applies Weak among artifact-eligible traits.');
    expect(filtered.users.empty).toBe('Nothing relies on Weak yet among artifact-eligible traits.');
  });

  it('says it is by name that nobody applies the key when a random or conditional source gives it', () => {
    expect(sectionsOf(viewOf({ random: many('r', 1) })).appliers.empty).toBe(
      'No trait applies Weak by name in the compendium.',
    );
    expect(sectionsOf(viewOf({ conditional: many('c', 1) }), true).appliers.empty).toBe(
      'No trait applies Weak by name among artifact-eligible traits.',
    );
  });
});
