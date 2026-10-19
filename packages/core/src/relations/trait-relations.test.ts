import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordHit, KeywordKind, KeywordRole, RandomDebuffSource, Trait } from '../model/trait';
import { buff, debuff, effect, event, mechanic } from '../taxonomy/entries';
import { createTaxonomy } from '../taxonomy/registry';
import { compareText, compareTextIgnoringCase } from '../text/compare-text';
import { createRelationIndex, type RelationIndex } from './relation-index';
import type { RelationOptions } from './relation-options';
import type { KeyLink, RelatedTrait, RelationSide, TraitRelations } from './trait-relations';

const taxonomy = createTaxonomy([
  debuff('Poisoned'),
  debuff('Weak'),
  debuff('Burning'),
  debuff('Inverted', { canBeRandomlyApplied: false }),
  buff('Barrier'),
  effect('Zombies'),
  mechanic('fused', 'Fused', ['Fused']),
  event('attack', 'Attack', { group: 'actions' }),
]);

function keyword(key: string, role: KeywordRole | undefined, kind: KeywordKind = 'debuff'): KeywordHit {
  return role === undefined ? { key, kind, span: [0, key.length] } : { key, kind, role, span: [0, key.length] };
}

const applies = (...keys: string[]) => keys.map((key) => keyword(key, 'applies'));
const uses = (...keys: string[]) => keys.map((key) => keyword(key, 'uses'));

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: 'Ferrous Ore',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const enemyRandom: RandomDebuffSource = { target: 'enemy', activation: 'unconditional' };
const emptySide: RelationSide = { several: [], single: [], unmet: [], count: 0 };

function relationsFrom(index: RelationIndex, id: string, options?: RelationOptions): TraitRelations {
  const found = index.relationsOf(id, options);
  if (found === undefined) throw new Error(`the index has no trait "${id}"`);
  return found;
}

const relationsOf = (traits: readonly Trait[], id: string, options?: RelationOptions) =>
  relationsFrom(createRelationIndex(traits, taxonomy), id, options);

const ids = (entries: readonly RelatedTrait[] | undefined) => entries?.map(({ trait: { id } }) => id);
const laneOf = (side: RelationSide, key: string) => ids(side.single.find((lane) => lane.key === key)?.entries);
const laneKeys = (side: RelationSide) => side.single.map(({ key }) => key);
const entriesOf = (side: RelationSide) => [...side.several, ...side.single.flatMap(({ entries }) => entries)];
const linksOf = (side: RelationSide, id: string): readonly KeyLink[] =>
  entriesOf(side).find(({ trait: { id: found } }) => found === id)?.links ?? [];

describe('relationsOf: the trait', () => {
  it('is undefined for an id the dataset does not have', () => {
    expect(createRelationIndex([trait('a')], taxonomy).relationsOf('b')).toBeUndefined();
  });

  it('has two empty sides for a trait that relies on and applies nothing', () => {
    expect(relationsOf([trait('a'), trait('b', { keywords: applies('weak') })], 'a')).toEqual({
      enabledBy: emptySide,
      enables: emptySide,
    });
  });
});

describe('relationsOf: Enabled by', () => {
  it('lists, in a lane for each key the focus relies on, the traits that apply it, in the order the focus names them', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...uses('poisoned')] }),
      trait('gives-poisoned', { keywords: applies('poisoned') }),
      trait('gives-weak', { keywords: applies('weak') }),
      trait('gives-weak-too', { keywords: applies('weak') }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(laneKeys(enabledBy)).toEqual(['weak', 'poisoned']);
    expect(laneOf(enabledBy, 'weak')).toEqual(['gives-weak', 'gives-weak-too']);
    expect(laneOf(enabledBy, 'poisoned')).toEqual(['gives-poisoned']);
    expect(enabledBy.several).toEqual([]);
    expect(enabledBy.count).toBe(3);
  });

  it('makes a lane for a key once however many times the focus names it', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...uses('poisoned'), ...uses('weak')] }),
      trait('gives', { keywords: applies('weak') }),
    ];

    expect(laneKeys(relationsOf(traits, 'focus').enabledBy)).toEqual(['weak']);
    expect(relationsOf(traits, 'focus').enabledBy.unmet).toEqual(['poisoned']);
  });

  it('reads only what the focus relies on: what it applies or guards against is no lane of this side', () => {
    const traits = [
      trait('focus', { keywords: [...applies('barrier'), keyword('burning', 'resists'), ...uses('poisoned')] }),
      trait('gives-barrier', { keywords: applies('barrier') }),
      trait('gives-burning', { keywords: applies('burning') }),
      trait('gives-poisoned', { keywords: applies('poisoned') }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(laneKeys(enabledBy)).toEqual(['poisoned']);
    expect(enabledBy.count).toBe(1);
  });

  it('ignores what is no dependency or that the taxonomy does not know: an event, a mechanic, a stranger', () => {
    const traits = [
      trait('focus', {
        keywords: [keyword('attack', 'uses', 'event'), keyword('fused', undefined, 'mechanic'), ...uses('shelled')],
      }),
      trait('gives', { keywords: [keyword('attack', 'applies', 'event'), ...applies('shelled')] }),
    ];

    expect(relationsOf(traits, 'focus').enabledBy).toEqual(emptySide);
  });

  it('lists a buff or an effect as it lists a debuff', () => {
    const traits = [
      trait('focus', { keywords: [keyword('barrier', 'uses', 'buff'), keyword('zombies', 'uses', 'effect')] }),
      trait('shields', { keywords: [keyword('barrier', 'applies', 'buff')] }),
      trait('raises', { keywords: [keyword('zombies', 'applies', 'effect')] }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(laneOf(enabledBy, 'barrier')).toEqual(['shields']);
    expect(laneOf(enabledBy, 'zombies')).toEqual(['raises']);
  });
});

describe('relationsOf: Enables', () => {
  it('lists, in a lane for each key the focus applies, the traits that rely on it, in the order the focus names them', () => {
    const traits = [
      trait('focus', { keywords: [...applies('weak'), ...applies('poisoned')] }),
      trait('needs-poisoned', { keywords: uses('poisoned') }),
      trait('needs-weak', { keywords: uses('weak') }),
      trait('needs-weak-too', { keywords: uses('weak') }),
    ];

    const { enables } = relationsOf(traits, 'focus');

    expect(laneKeys(enables)).toEqual(['weak', 'poisoned']);
    expect(laneOf(enables, 'weak')).toEqual(['needs-weak', 'needs-weak-too']);
    expect(laneOf(enables, 'poisoned')).toEqual(['needs-poisoned']);
    expect(enables.count).toBe(3);
  });

  it('ignores a trait that only guards against the key: protection relies on nobody (GAME_RULES R9)', () => {
    const traits = [
      trait('focus', { keywords: applies('weak') }),
      trait('immune', { keywords: [keyword('weak', 'resists')] }),
    ];

    expect(relationsOf(traits, 'focus').enables).toEqual({ ...emptySide, unmet: ['weak'] });
  });

  it('lists only what the focus applies by name: a random or conditional source enables nobody here', () => {
    const traits = [
      trait('pandemic', { randomDebuff: enemyRandom }),
      trait('pair', { keywords: [...uses('poisoned'), ...uses('weak')], conditionalSources: ['poisoned', 'weak'] }),
      trait('needs', { keywords: [...uses('poisoned'), ...uses('weak')] }),
    ];

    expect(relationsOf(traits, 'pandemic').enables).toEqual(emptySide);
    expect(relationsOf(traits, 'pair').enables).toEqual(emptySide);
  });

  it('gives every link the specific strength: the focus applies the key by name', () => {
    const traits = [trait('focus', { keywords: applies('weak') }), trait('needs', { keywords: uses('weak') })];

    expect(linksOf(relationsOf(traits, 'focus').enables, 'needs')).toEqual([{ key: 'weak', strength: 'specific' }]);
  });
});

describe('relationsOf: the focus and the two sides', () => {
  it('puts a trait that applies and relies on one key on both sides', () => {
    const traits = [
      trait('focus', { keywords: [...uses('weak'), ...applies('poisoned')] }),
      trait('both', { keywords: [...applies('weak'), ...uses('poisoned')] }),
    ];

    const { enabledBy, enables } = relationsOf(traits, 'focus');

    expect(laneOf(enabledBy, 'weak')).toEqual(['both']);
    expect(laneOf(enables, 'poisoned')).toEqual(['both']);
  });

  it('leaves the focus out of its own lists though it gives what it relies on', () => {
    const traits = [trait('focus', { keywords: [...applies('weak'), ...uses('weak')] })];

    const { enabledBy, enables } = relationsOf(traits, 'focus');

    expect(enabledBy).toEqual({ ...emptySide, unmet: ['weak'] });
    expect(enables).toEqual({ ...emptySide, unmet: ['weak'] });
  });

  it('leaves a conditional source out of the lists of its own keys', () => {
    const pair = trait('pair', {
      keywords: [...uses('poisoned'), ...uses('weak')],
      conditionalSources: ['poisoned', 'weak'],
    });

    expect(relationsOf([pair], 'pair').enabledBy).toEqual({ ...emptySide, unmet: ['poisoned', 'weak'] });
  });

  it('leaves a random source out of the lists of its own keys', () => {
    const pandemic = trait('pandemic', { keywords: uses('burning'), randomDebuff: enemyRandom });

    expect(relationsOf([pandemic], 'pandemic').enabledBy).toEqual({ ...emptySide, unmet: ['burning'] });
  });
});

describe('relationsOf: a trait once per side (PLAN D17)', () => {
  const focus = trait('focus', { keywords: [...uses('weak'), ...uses('poisoned'), ...uses('burning')] });

  it('puts a trait that links to several keys in the several lane only, once, with a link for each key in the focus order', () => {
    const traits = [focus, trait('both', { keywords: [...applies('poisoned'), ...applies('weak')] })];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.several).toEqual([
      {
        trait: traits[1],
        links: [
          { key: 'weak', strength: 'specific' },
          { key: 'poisoned', strength: 'specific' },
        ],
        score: 2,
        strength: 'specific',
      },
    ]);
    expect(enabledBy.single).toEqual([]);
    expect(enabledBy.unmet).toEqual(['burning']);
    expect(enabledBy.count).toBe(1);
  });

  it('keeps a trait that links to one key in the lane of that key, whatever else it applies', () => {
    const traits = [focus, trait('one', { keywords: [...applies('weak'), ...applies('barrier')] })];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.several).toEqual([]);
    expect(laneOf(enabledBy, 'weak')).toEqual(['one']);
    expect(enabledBy.single.flatMap(({ entries }) => entries.map(({ score }) => score))).toEqual([1]);
  });

  it('does the same on the Enables side: a trait that relies on two keys the focus applies is listed once', () => {
    const traits = [
      trait('focus', { keywords: [...applies('weak'), ...applies('poisoned')] }),
      trait('needs-both', { keywords: [...uses('poisoned'), ...uses('weak')] }),
    ];

    const { enables } = relationsOf(traits, 'focus');

    expect(ids(enables.several)).toEqual(['needs-both']);
    expect(enables.single).toEqual([]);
  });
});

describe('relationsOf: the order', () => {
  const focus = trait('focus', { keywords: [...uses('weak'), ...uses('poisoned'), ...uses('burning')] });

  it('ranks specific before conditional before random, whatever the score', () => {
    const traits = [
      focus,
      trait('random-three', { randomDebuff: enemyRandom }),
      trait('conditional-two', { conditionalSources: ['weak', 'poisoned'] }),
      trait('specific-two', { keywords: applies('weak', 'poisoned') }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(ids(enabledBy.several)).toEqual(['specific-two', 'conditional-two', 'random-three']);
    expect(enabledBy.several.map(({ strength, score }) => [strength, score])).toEqual([
      ['specific', 2],
      ['conditional', 2],
      ['random', 3],
    ]);
  });

  it('ranks by the number of links within a tier', () => {
    const traits = [
      focus,
      trait('two', { keywords: applies('weak', 'poisoned') }),
      trait('three', { keywords: applies('weak', 'poisoned', 'burning') }),
    ];

    expect(ids(relationsOf(traits, 'focus').enabledBy.several)).toEqual(['three', 'two']);
  });

  it('then by name regardless of case, then by the exact name, then by id', () => {
    const traits = [
      focus,
      trait('i1', { name: 'b', keywords: applies('weak') }),
      trait('i2', { name: 'a', keywords: applies('weak') }),
      trait('i3', { name: 'A', keywords: applies('weak') }),
      trait('z-same', { name: 'Same', keywords: applies('weak') }),
      trait('a-same', { name: 'Same', keywords: applies('weak') }),
    ];

    expect(laneOf(relationsOf(traits, 'focus').enabledBy, 'weak')).toEqual(['i3', 'i2', 'i1', 'a-same', 'z-same']);
  });

  it('puts a random source last in the lane of a key it can afflict at random, after the specific and conditional ones', () => {
    const traits = [
      trait('focus', { keywords: uses('poisoned') }),
      trait('a-pandemic', { randomDebuff: enemyRandom }),
      trait('b-pair', { conditionalSources: ['poisoned', 'weak'] }),
      trait('c-gives', { keywords: applies('poisoned') }),
    ];

    expect(laneOf(relationsOf(traits, 'focus').enabledBy, 'poisoned')).toEqual(['c-gives', 'b-pair', 'a-pandemic']);
  });
});

describe('relationsOf: random sources (GAME_RULES R5, R8)', () => {
  it('lists a random source once, linked through every debuff the focus relies on that can be random', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak'), ...uses('inverted')] }),
      trait('pandemic', { randomDebuff: enemyRandom }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.several).toEqual([
      {
        trait: traits[1],
        links: [
          { key: 'poisoned', strength: 'random' },
          { key: 'weak', strength: 'random' },
        ],
        score: 2,
        strength: 'random',
      },
    ]);
    expect(enabledBy.unmet).toEqual(['inverted']);
  });

  it('lists a random source in the single lane when the focus relies on one debuff that can be random', () => {
    const traits = [trait('focus', { keywords: uses('weak') }), trait('pandemic', { randomDebuff: enemyRandom })];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(laneOf(enabledBy, 'weak')).toEqual(['pandemic']);
    expect(enabledBy.single.flatMap(({ entries }) => entries.map(({ strength }) => strength))).toEqual(['random']);
  });

  it('never lists one for a buff or an effect', () => {
    const traits = [
      trait('focus', { keywords: [keyword('barrier', 'uses', 'buff'), keyword('zombies', 'uses', 'effect')] }),
      trait('pandemic', { randomDebuff: enemyRandom }),
    ];

    expect(relationsOf(traits, 'focus').enabledBy).toEqual({ ...emptySide, unmet: ['barrier', 'zombies'] });
  });

  it('never lists a trait whose random debuff lands on the party', () => {
    const traits = [
      trait('focus', { keywords: uses('weak') }),
      trait('going-mad', { randomDebuff: { target: 'self_or_allies', activation: 'unconditional' } }),
      trait('glitch', { randomDebuff: { target: 'both', activation: 'unconditional' } }),
    ];

    expect(relationsOf(traits, 'focus').enabledBy).toEqual({ ...emptySide, unmet: ['weak'] });
  });

  it('keeps the strength of each link when a trait applies one debuff by name and afflicts the others at random', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak')] }),
      trait('mixed', { keywords: applies('weak'), randomDebuff: enemyRandom }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.several).toEqual([
      {
        trait: traits[1],
        links: [
          { key: 'poisoned', strength: 'random' },
          { key: 'weak', strength: 'specific' },
        ],
        score: 2,
        strength: 'specific',
      },
    ]);
  });
});

describe('relationsOf: conditional sources (GAME_RULES R10)', () => {
  it('lists a trait that waits for one debuff of a pair to give the other as conditional, for each debuff of its pair', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak')] }),
      trait('sibling', {
        keywords: [...uses('poisoned'), ...uses('burning')],
        conditionalSources: ['poisoned', 'burning'],
      }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(laneOf(enabledBy, 'poisoned')).toEqual(['sibling']);
    expect(linksOf(enabledBy, 'sibling')).toEqual([{ key: 'poisoned', strength: 'conditional' }]);
    expect(enabledBy.unmet).toEqual(['weak']);
  });

  it('lists a trait that is the conditional source of two keys of the focus once, in the several lane', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak')] }),
      trait('pair', { keywords: [...uses('poisoned'), ...uses('weak')], conditionalSources: ['poisoned', 'weak'] }),
    ];

    expect(relationsOf(traits, 'focus').enabledBy.several.map(({ strength, score }) => [strength, score])).toEqual([
      ['conditional', 2],
    ]);
  });
});

describe('relationsOf: keys nobody gives or relies on', () => {
  it('names a key with no trait on its side as unmet, in the focus order', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak'), ...uses('burning')] }),
      trait('gives', { keywords: applies('weak') }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.unmet).toEqual(['poisoned', 'burning']);
    expect(laneKeys(enabledBy)).toEqual(['weak']);
  });

  it('does not name a key unmet because its traits sit in the several lane', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak')] }),
      trait('both', { keywords: applies('poisoned', 'weak') }),
    ];

    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.unmet).toEqual([]);
    expect(enabledBy.single).toEqual([]);
  });

  it('counts each trait of a side once', () => {
    const traits = [
      trait('focus', { keywords: [...uses('poisoned'), ...uses('weak')] }),
      trait('both', { keywords: applies('poisoned', 'weak') }),
      trait('one', { keywords: applies('weak') }),
      trait('other', { keywords: applies('poisoned') }),
    ];

    expect(relationsOf(traits, 'focus').enabledBy.count).toBe(3);
  });
});

describe('relationsOf: only artifact-eligible traits', () => {
  const traits = [
    trait('focus', { keywords: [...uses('weak'), ...uses('poisoned')], material: null }),
    trait('with-material', { keywords: applies('weak') }),
    trait('no-material', { keywords: applies('weak'), material: null }),
    trait('lone-no-material', { keywords: applies('poisoned'), material: null }),
    trait('both-no-material', { keywords: applies('poisoned', 'weak'), material: null }),
    trait('needs', { keywords: uses('weak') }),
  ];

  it('keeps every trait by default', () => {
    const { enabledBy } = relationsOf(traits, 'focus');

    expect(enabledBy.count).toBe(4);
    expect(relationsOf(traits, 'focus', {})).toEqual(relationsOf(traits, 'focus', { artifactOnly: false }));
    expect(relationsOf(traits, 'focus')).toEqual(relationsOf(traits, 'focus', {}));
  });

  it('drops a trait without material from every lane and from the count', () => {
    const { enabledBy } = relationsOf(traits, 'focus', { artifactOnly: true });

    expect(laneOf(enabledBy, 'weak')).toEqual(['with-material']);
    expect(enabledBy.several).toEqual([]);
    expect(enabledBy.count).toBe(1);
  });

  it('names a key unmet when only traits without material give it', () => {
    expect(relationsOf(traits, 'focus', { artifactOnly: true }).enabledBy.unmet).toEqual(['poisoned']);
  });

  it('drops them on the other side too', () => {
    const focus = trait('f', { keywords: applies('weak') });
    const others = [
      focus,
      trait('a', { keywords: uses('weak') }),
      trait('b', { keywords: uses('weak'), material: null }),
    ];

    expect(laneOf(relationsOf(others, 'f', { artifactOnly: true }).enables, 'weak')).toEqual(['a']);
  });

  it('never drops the focus: its relations are read whatever its material', () => {
    const { enabledBy } = relationsOf(traits, 'focus', { artifactOnly: true });

    expect(enabledBy.count).toBe(1);
  });

  it('drops the focus as a candidate of another trait when it has no material', () => {
    const { enables } = relationsOf(traits, 'with-material', { artifactOnly: true });

    expect(laneOf(enables, 'weak')).toEqual(['needs']);
  });
});

describe('relationsOf: invariants', () => {
  interface TraitShape {
    readonly keywords: readonly { readonly key: string; readonly role: KeywordRole | undefined }[];
    readonly conditionalSources: readonly string[];
    readonly randomDebuff: RandomDebuffSource | null;
    readonly hasMaterial: boolean;
  }
  // Dense on purpose: a trait tied to two keys of a focus needs a few keys in play, mostly given and relied on, or the
  // several lane and the ranking would hardly ever be exercised.
  const keywordArbitrary = fc.record({
    key: fc.oneof(
      { weight: 5, arbitrary: fc.constantFrom('poisoned', 'weak', 'burning', 'barrier') },
      { weight: 1, arbitrary: fc.constantFrom('inverted', 'zombies', 'attack', 'fused', 'unknown') },
    ),
    role: fc.constantFrom<KeywordRole | undefined>('applies', 'applies', 'uses', 'uses', 'resists', undefined),
  });
  const shapesArbitrary = fc.array<TraitShape>(
    fc.record({
      keywords: fc.array(keywordArbitrary, { maxLength: 6 }),
      conditionalSources: fc.array(fc.constantFrom('poisoned', 'weak', 'burning', 'barrier', 'attack', 'unknown'), {
        maxLength: 2,
      }),
      randomDebuff: fc.constantFrom<RandomDebuffSource | null>(null, null, null, null, enemyRandom, {
        target: 'both',
        activation: 'unconditional',
      }),
      hasMaterial: fc.boolean(),
    }),
    { maxLength: 16 },
  );
  const build = (shapes: readonly TraitShape[]): Trait[] =>
    shapes.map(({ keywords, conditionalSources, randomDebuff, hasMaterial }, position) =>
      trait(`t${position}`, {
        keywords: keywords.map(({ key, role }) => keyword(key, role, taxonomy.get(key)?.kind ?? 'debuff')),
        conditionalSources,
        randomDebuff,
        material: hasMaterial ? 'Ferrous Ore' : null,
      }),
    );
  const sides = (index: RelationIndex, focus: Trait) => {
    const { enabledBy, enables } = relationsFrom(index, focus.id);
    return [enabledBy, enables] as const;
  };
  const tier = (entry: RelatedTrait) => ['specific', 'conditional', 'random'].indexOf(entry.strength);
  const inRankOrder = (entries: readonly RelatedTrait[]) =>
    entries.every((entry, at) => {
      const before = entries[at - 1];
      if (before === undefined) return true;
      const order =
        tier(before) - tier(entry) ||
        entry.score - before.score ||
        compareTextIgnoringCase(before.trait.name, entry.trait.name) ||
        compareText(before.trait.id, entry.trait.id);
      return order <= 0;
    });
  const withMaterial = (entries: readonly RelatedTrait[]) =>
    entries.filter(({ trait: { material } }) => material !== null);

  it('lists a trait once per side, never the focus, and counts what it lists', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        for (const focus of traits) {
          for (const side of sides(index, focus)) {
            const listed = ids(entriesOf(side)) ?? [];
            expect(new Set(listed).size).toBe(listed.length);
            expect(listed).not.toContain(focus.id);
            expect(side.count).toBe(listed.length);
          }
        }
      }),
    );
  });

  it('gives a trait the several lane when it has two links or more and a single lane otherwise, with links to distinct keys', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        for (const focus of traits) {
          for (const side of sides(index, focus)) {
            for (const entry of side.several) expect(entry.score).toBeGreaterThanOrEqual(2);
            for (const { key, entries } of side.single) {
              for (const entry of entries) expect(entry.links.map((link) => link.key)).toEqual([key]);
            }
            for (const entry of entriesOf(side)) {
              expect(entry.score).toBe(entry.links.length);
              expect(new Set(entry.links.map((link) => link.key)).size).toBe(entry.links.length);
            }
          }
        }
      }),
    );
  });

  it('ranks the several lane and each single lane by tier, score, name and id', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        for (const focus of traits) {
          for (const side of sides(index, focus)) {
            expect(inRankOrder(side.several)).toBe(true);
            for (const { entries } of side.single) expect(inRankOrder(entries)).toBe(true);
          }
        }
      }),
      // Two candidates of one tier with different scores in one lane are rare in the default hundred runs.
      { numRuns: 1000 },
    );
  });

  it('links the Enables side by name only: every link there is specific', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        for (const focus of traits) {
          for (const entry of entriesOf(relationsFrom(index, focus.id).enables)) {
            expect(entry.strength).toBe('specific');
            for (const link of entry.links) expect(link.strength).toBe('specific');
          }
        }
      }),
    );
  });

  it('is symmetric on the specific links: A enables B through some keys exactly when B is enabled by A through them', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        const specificKeys = (side: RelationSide, id: string) =>
          linksOf(side, id)
            .filter(({ strength }) => strength === 'specific')
            .map(({ key }) => key)
            .toSorted();
        for (const a of traits) {
          for (const b of traits) {
            if (a === b) continue;
            const enabledByB = specificKeys(relationsFrom(index, b.id).enabledBy, a.id);
            const enablesA = specificKeys(relationsFrom(index, a.id).enables, b.id);
            expect(enablesA, `${a.id} enables ${b.id}`).toEqual(enabledByB);
          }
        }
      }),
    );
  });

  it('is the same whatever the order the traits were given in', () => {
    fc.assert(
      fc.property(
        shapesArbitrary.chain((shapes) => {
          const traits = build(shapes);
          return fc.tuple(
            fc.constant(traits),
            fc.shuffledSubarray(traits, { minLength: traits.length, maxLength: traits.length }),
          );
        }),
        ([traits, shuffled]) => {
          const index = createRelationIndex(traits, taxonomy);
          const shuffledIndex = createRelationIndex(shuffled, taxonomy);
          for (const focus of traits) {
            for (const options of [{}, { artifactOnly: true }]) {
              expect(relationsFrom(shuffledIndex, focus.id, options)).toEqual(relationsFrom(index, focus.id, options));
            }
          }
        },
      ),
    );
  });

  it('with the artifact filter keeps, in the same lanes and the same order, the traits with material of the whole lists', () => {
    fc.assert(
      fc.property(shapesArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        for (const focus of traits) {
          const whole = relationsFrom(index, focus.id);
          const eligible = relationsFrom(index, focus.id, { artifactOnly: true });
          for (const [all, kept] of [
            [whole.enabledBy, eligible.enabledBy],
            [whole.enables, eligible.enables],
          ] as const) {
            expect(ids(kept.several)).toEqual(ids(withMaterial(all.several)));
            expect(kept.single.map(({ key, entries }) => [key, ids(entries)])).toEqual(
              all.single
                .map(({ key, entries }) => [key, ids(withMaterial(entries))] as const)
                .filter(([, left]) => left?.length !== 0),
            );
            expect(kept.count).toBe(withMaterial(entriesOf(all)).length);
          }
        }
      }),
    );
  });
});
