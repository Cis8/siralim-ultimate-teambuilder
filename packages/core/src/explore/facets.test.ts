import { describe, expect, it } from 'vitest';
import type { KeywordActor, KeywordHit, KeywordKind, KeywordRole, Trait } from '../model/trait';
import { createTraitIndex } from '../query/trait-index';
import type { TaxonomyEntry } from '../taxonomy/entry';
import { createTaxonomy } from '../taxonomy/registry';
import { countFacets, facetCount, facetVocabulary } from './facets';

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

const mention = (key: string, kind: KeywordKind, role?: KeywordRole, actor?: KeywordActor): KeywordHit => ({
  key,
  kind,
  ...(role === undefined ? {} : { role }),
  ...(actor === undefined ? {} : { actor }),
  span: [0, 1],
});

const entry = (kind: TaxonomyEntry['kind'], key: string, extra: object = {}): TaxonomyEntry =>
  ({ kind, key, label: key.toUpperCase(), patterns: [key], ...extra }) as TaxonomyEntry;

// Not in the order of the facets, to see them put in order.
const taxonomy = createTaxonomy([
  entry('mechanic', 'timeline'),
  entry('buff', 'shelled'),
  entry('debuff', 'weak', { canBeRandomlyApplied: true }),
  entry('flag', 'nostack'),
  entry('event', 'start of battle', { group: 'battle', phase: 'startOfBattle' }),
  entry('debuff', 'vulnerable', { canBeRandomlyApplied: true }),
  entry('effect', 'zombies'),
  entry('event', 'attack', { group: 'actions', phase: 'attacking' }),
]);

describe('facetVocabulary', () => {
  const classesOf = (...names: string[]) =>
    facetVocabulary(createTraitIndex(names.map((name, at) => trait(`t${String(at)}`, { class: name }))), taxonomy)
      .classes;

  it('lists the classes of the dataset once each, as it spells them', () => {
    const index = createTraitIndex([
      trait('a', { class: 'Sorcery' }),
      trait('b', { class: 'Death' }),
      trait('c', { class: 'Nether Boss' }),
      trait('d', { class: 'Death' }),
      trait('e', { class: 'Boss' }),
    ]);

    expect(
      facetVocabulary(index, taxonomy)
        .classes.map(({ name }) => name)
        .toSorted(),
    ).toEqual(['Boss', 'Death', 'Nether Boss', 'Sorcery']);
  });

  it('puts the five classes of a creature first, from A to Z, whatever the order of the dataset', () => {
    const names = classesOf('Sorcery', 'Nature', 'Life', 'Death', 'Chaos', 'Backer', 'Backer').map(({ name }) => name);

    expect(names).toEqual(['Chaos', 'Death', 'Life', 'Nature', 'Sorcery', 'Backer']);
  });

  it('puts the others after them, the class with most traits first', () => {
    const names = classesOf(
      'Life',
      ...Array<string>(3).fill('Nether Boss'),
      ...Array<string>(5).fill('Rodian Master'),
      'Boss',
      ...Array<string>(2).fill('Backer'),
    ).map(({ name }) => name);

    expect(names).toEqual(['Life', 'Rodian Master', 'Nether Boss', 'Backer', 'Boss']);
  });

  it('puts classes with as many traits in the order A to Z', () => {
    const names = classesOf('Pandemonium', 'Nether Room', 'Boss', 'Life').map(({ name }) => name);

    expect(names).toEqual(['Life', 'Boss', 'Nether Room', 'Pandemonium']);
  });

  it('orders the others by the traits of the whole dataset, so that the list does not move as filters change', () => {
    const index = createTraitIndex([
      trait('a', { class: 'Boss' }),
      trait('b', { class: 'Backer' }),
      trait('c', { class: 'Backer' }),
    ]);
    const vocabulary = facetVocabulary(index, taxonomy);
    const onlyTheBoss = index.entries.filter(({ trait: each }) => each.class === 'Boss');

    const facets = countFacets(vocabulary, onlyTheBoss, onlyTheBoss);

    expect(facets.classes.map(({ name, count }) => `${name}:${String(count)}`)).toEqual(['Backer:0', 'Boss:1']);
  });

  it('says which classes are the five of a creature', () => {
    expect(classesOf('Backer', 'Chaos', 'Nether Boss', 'Sorcery')).toEqual([
      { name: 'Chaos', standard: true },
      { name: 'Sorcery', standard: true },
      { name: 'Backer', standard: false },
      { name: 'Nether Boss', standard: false },
    ]);
  });

  it('counts classes that differ only in letter case as one, spelled as first met', () => {
    const index = createTraitIndex([trait('a', { class: 'Life' }), trait('b', { class: 'life' })]);

    expect(facetVocabulary(index, taxonomy).classes).toEqual([{ name: 'Life', standard: true }]);
  });

  it('lists the keywords of the taxonomy by kind, then in the order of the taxonomy, without the flags', () => {
    const { keywords } = facetVocabulary(createTraitIndex([]), taxonomy);

    expect(keywords.map(({ kind, key }) => `${kind}:${key}`)).toEqual([
      'debuff:weak',
      'debuff:vulnerable',
      'buff:shelled',
      'effect:zombies',
      'event:start of battle',
      'event:attack',
      'mechanic:timeline',
    ]);
  });

  it('gives an event the group it is listed under, and no other keyword one', () => {
    const { keywords } = facetVocabulary(createTraitIndex([]), taxonomy);

    expect(
      keywords.filter((keyword) => keyword.kind === 'event').map(({ key, group }) => `${key}:${String(group)}`),
    ).toEqual(['start of battle:battle', 'attack:actions']);
    expect(keywords.filter((keyword) => keyword.kind !== 'event').every((keyword) => !('group' in keyword))).toBe(true);
  });

  it('lists no class for an empty dataset', () => {
    expect(facetVocabulary(createTraitIndex([]), taxonomy).classes).toEqual([]);
  });
});

describe('countFacets', () => {
  const traits = [
    trait('gives-weak', { class: 'Death', keywords: [mention('weak', 'debuff', 'applies')] }),
    trait('gives-weak-twice', {
      class: 'Life',
      keywords: [mention('weak', 'debuff', 'applies'), mention('weak', 'debuff', 'applies')],
    }),
    trait('relies-on-weak', { class: 'Life', keywords: [mention('weak', 'debuff', 'uses')] }),
    trait('does-both', {
      class: 'Death',
      keywords: [mention('weak', 'debuff', 'applies'), mention('weak', 'debuff', 'uses')],
    }),
    trait('guards-against-weak', { class: 'Nature', keywords: [mention('weak', 'debuff', 'resists')] }),
    trait('at-the-start', {
      class: 'Nature',
      keywords: [mention('start of battle', 'event', 'uses'), mention('timeline', 'mechanic')],
    }),
    trait('plain', { class: 'Nature' }),
  ];
  const index = createTraitIndex(traits);
  const vocabulary = facetVocabulary(index, taxonomy);
  const facetsFor = (found: readonly string[], withoutClassFilter: readonly string[] = found) =>
    countFacets(
      vocabulary,
      index.entries.filter(({ trait: each }) => withoutClassFilter.includes(each.id)),
      index.entries.filter(({ trait: each }) => found.includes(each.id)),
    );
  const everyone = traits.map(({ id }) => id);
  const keywordFacet = (found: readonly string[], key: string) =>
    facetsFor(found).keywords.find((facet) => facet.key === key);

  describe('classes', () => {
    it('counts the traits of each class among those the class filter leaves out of account', () => {
      const facets = facetsFor(['gives-weak'], everyone);

      expect(facets.classes).toEqual([
        { name: 'Death', count: 2, standard: true },
        { name: 'Life', count: 2, standard: true },
        { name: 'Nature', count: 3, standard: true },
      ]);
    });

    it('lists a class with no trait there with a count of 0', () => {
      expect(facetsFor(['gives-weak'], ['gives-weak']).classes).toEqual([
        { name: 'Death', count: 1, standard: true },
        { name: 'Life', count: 0, standard: true },
        { name: 'Nature', count: 0, standard: true },
      ]);
    });

    it('counts without regard to the traits that the filter on classes would keep', () => {
      const facets = facetsFor([], ['does-both', 'plain']);

      expect(facets.classes.map(({ count }) => count)).toEqual([1, 0, 1]);
    });
  });

  describe('keywords', () => {
    it('counts the traits that apply, rely on, and mention each, among the traits found', () => {
      expect(keywordFacet(everyone, 'weak')).toEqual({
        key: 'weak',
        label: 'WEAK',
        kind: 'debuff',
        applies: 3,
        uses: 2,
        mentions: 5,
      });
    });

    it('counts a trait once per keyword, however many times it mentions it', () => {
      expect(keywordFacet(['gives-weak-twice'], 'weak')).toMatchObject({ applies: 1, uses: 0, mentions: 1 });
    });

    it('counts a trait that applies and relies on a keyword in both', () => {
      expect(keywordFacet(['does-both'], 'weak')).toMatchObject({ applies: 1, uses: 1, mentions: 1 });
    });

    it('counts a mention that only guards against a keyword as a mention, not a role', () => {
      expect(keywordFacet(['guards-against-weak'], 'weak')).toMatchObject({ applies: 0, uses: 0, mentions: 1 });
    });

    it('counts an event by its role, as a buff', () => {
      expect(keywordFacet(everyone, 'start of battle')).toMatchObject({ applies: 0, uses: 1, mentions: 1 });
    });

    it('counts a mechanic as a mention, with no role', () => {
      expect(keywordFacet(everyone, 'timeline')).toMatchObject({ applies: 0, uses: 0, mentions: 1 });
    });

    it('counts only the traits found', () => {
      expect(keywordFacet(['relies-on-weak', 'plain'], 'weak')).toMatchObject({ applies: 0, uses: 1, mentions: 1 });
    });

    it('lists every keyword of the taxonomy, with 0 for one nobody mentions', () => {
      const { keywords } = facetsFor([]);

      expect(keywords).toHaveLength(7);
      expect(keywords.every(({ applies, uses, mentions }) => applies + uses + mentions === 0)).toBe(true);
    });

    it('lists the keywords in the order of the vocabulary', () => {
      expect(facetsFor(everyone).keywords.map(({ key }) => key)).toEqual(vocabulary.keywords.map(({ key }) => key));
    });

    it('leaves out a keyword that the taxonomy does not know', () => {
      const unknown = createTraitIndex([trait('x', { keywords: [mention('mystery', 'debuff', 'applies')] })]);
      const { keywords } = countFacets(vocabulary, unknown.entries, unknown.entries);

      expect(keywords.map(({ key }) => key)).not.toContain('mystery');
    });
  });

  describe('events, by the actor the text names', () => {
    const attack = (role: KeywordRole, ...actors: (KeywordActor | undefined)[]) =>
      actors.map((actor) => mention('attack', 'event', role, actor));
    const eventTraits = [
      trait('self', { keywords: attack('uses', 'self') }),
      trait('self-twice', { keywords: attack('uses', 'self', 'self') }),
      trait('ally', { keywords: attack('uses', 'ally') }),
      trait('enemy-causes', { keywords: attack('applies', 'enemy') }),
      trait('self-and-enemy', { keywords: attack('uses', 'self', 'enemy') }),
      trait('nobody', { keywords: attack('uses', undefined) }),
      trait('guards', { keywords: attack('resists', 'enemy') }),
      trait('the-start', { keywords: [mention('start of battle', 'event', 'uses')] }),
    ];
    const eventIndex = createTraitIndex(eventTraits);
    const eventVocabulary = facetVocabulary(eventIndex, taxonomy);
    const eventFacet = (key: string, found: readonly string[] = eventTraits.map(({ id }) => id)) => {
      const traitsFound = eventIndex.entries.filter(({ trait: each }) => found.includes(each.id));
      return countFacets(eventVocabulary, traitsFound, traitsFound).keywords.find((facet) => facet.key === key);
    };

    it('counts the traits that cause it or react to it for each actor', () => {
      expect(eventFacet('attack')?.byActor).toEqual({
        self: { applies: 0, uses: 3 },
        ally: { applies: 0, uses: 1 },
        enemy: { applies: 1, uses: 1 },
        any: { applies: 0, uses: 0 },
      });
    });

    it('counts a trait once for an actor, however often its text names it', () => {
      expect(eventFacet('attack', ['self-twice'])?.byActor?.self).toEqual({ applies: 0, uses: 1 });
    });

    it('counts a trait that names two actors for each of them', () => {
      expect(eventFacet('attack', ['self-and-enemy'])?.byActor).toMatchObject({
        self: { uses: 1 },
        enemy: { uses: 1 },
      });
    });

    it('keeps the count by anyone as it is: every trait that has the event, whoever acts, and none for a mention with no actor', () => {
      expect(eventFacet('attack')).toMatchObject({ applies: 1, uses: 5, mentions: 7 });
      expect(eventFacet('attack', ['nobody'])).toMatchObject({ uses: 1 });
      expect(eventFacet('attack', ['nobody'])?.byActor).toEqual({
        self: { applies: 0, uses: 0 },
        ally: { applies: 0, uses: 0 },
        enemy: { applies: 0, uses: 0 },
        any: { applies: 0, uses: 0 },
      });
    });

    it('counts only the traits found', () => {
      expect(eventFacet('attack', ['ally', 'the-start'])?.byActor?.self).toEqual({ applies: 0, uses: 0 });
      expect(eventFacet('attack', ['ally', 'the-start'])?.byActor?.ally).toEqual({ applies: 0, uses: 1 });
    });

    it('has the counts of every event, zeros for one that names nobody', () => {
      expect(eventFacet('start of battle')?.byActor?.self).toEqual({ applies: 0, uses: 0 });
    });

    it('has no count by actor for a keyword that is no event', () => {
      expect(keywordFacet(everyone, 'weak')).not.toHaveProperty('byActor');
      expect(keywordFacet(everyone, 'timeline')).not.toHaveProperty('byActor');
    });
  });
});

describe('facetCount', () => {
  const byActor = {
    self: { applies: 1, uses: 2 },
    ally: { applies: 3, uses: 4 },
    enemy: { applies: 5, uses: 6 },
    any: { applies: 7, uses: 8 },
  };
  const attack = { applies: 20, uses: 30, byActor };

  it('is the number of traits that have the side, whoever acts, when no actor is asked for', () => {
    expect(facetCount(attack, 'applies')).toBe(20);
    expect(facetCount(attack, 'uses')).toBe(30);
  });

  it('is the number of traits whose text names the actor, when one is', () => {
    expect(facetCount(attack, 'applies', 'enemy')).toBe(5);
    expect(facetCount(attack, 'uses', 'self')).toBe(2);
    expect(facetCount(attack, 'uses', 'any')).toBe(8);
  });

  it('is 0 for an actor where nothing names one: a buff has no one acting', () => {
    expect(facetCount({ applies: 4, uses: 5 }, 'applies', 'self')).toBe(0);
    expect(facetCount({ applies: 4, uses: 5 }, 'applies')).toBe(4);
  });
});
