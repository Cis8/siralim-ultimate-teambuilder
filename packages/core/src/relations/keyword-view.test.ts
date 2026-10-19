import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordHit, KeywordKind, KeywordRole, RandomDebuffSource, Trait } from '../model/trait';
import { buff, debuff, effect, event, flag, mechanic } from '../taxonomy/entries';
import { createTaxonomy } from '../taxonomy/registry';
import { verdictOf, type KeywordStats, type KeywordView } from './keyword-view';
import { createRelationIndex, type RelationIndex } from './relation-index';
import type { RelationOptions } from './relation-options';

const taxonomy = createTaxonomy([
  debuff('Poisoned'),
  debuff('Weak'),
  debuff('Inverted', { canBeRandomlyApplied: false }),
  buff('Barrier'),
  effect('Zombies'),
  mechanic('fused', 'Fused', ['Fused']),
  event('attack', 'Attack', { group: 'actions' }),
  flag('no stack', 'No stack', ['does not stack']),
]);
const KEYS = ['poisoned', 'weak', 'inverted', 'barrier', 'zombies'];

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

function viewIn(index: RelationIndex, key: string, options?: RelationOptions): KeywordView {
  const found = index.keywordView(key, options);
  if (found === undefined) throw new Error(`the index has no key "${key}"`);
  return found;
}

const viewOf = (traits: readonly Trait[], key: string, options?: RelationOptions) =>
  viewIn(createRelationIndex(traits, taxonomy), key, options);

const ids = (list: readonly Trait[] | undefined) => list?.map(({ id }) => id);
const stats = (appliers: number, conditional: number, random: number, users: number): KeywordStats => ({
  appliers,
  conditional,
  random,
  users,
});

describe('keywordView: which keys have one', () => {
  it('is undefined for a key that cannot be a dependency and for one the taxonomy does not have', () => {
    const index = createRelationIndex([trait('a', { keywords: applies('poisoned') })], taxonomy);

    expect(index.keywordView('attack')).toBeUndefined();
    expect(index.keywordView('fused')).toBeUndefined();
    expect(index.keywordView('no stack')).toBeUndefined();
    expect(index.keywordView('shelled')).toBeUndefined();
  });

  it('is there for every buff, debuff and effect, empty when nobody mentions it', () => {
    const index = createRelationIndex([], taxonomy);

    for (const key of KEYS) {
      expect(index.keywordView(key)).toEqual({
        key,
        appliers: [],
        conditional: [],
        random: [],
        users: [],
        stats: stats(0, 0, 0, 0),
        verdict: 'no-source',
        coApplied: [],
      });
    }
  });

  it('has the lists of the relation index, in the order of the dataset', () => {
    const traits = [
      trait('rely', { keywords: uses('weak') }),
      trait('pandemic', { randomDebuff: enemyRandom }),
      trait('apply-b', { keywords: applies('weak') }),
      trait('pair', { keywords: uses('weak', 'poisoned'), conditionalSources: ['weak', 'poisoned'] }),
      trait('apply-a', { keywords: applies('weak') }),
    ];

    const view = viewOf(traits, 'weak');

    expect(ids(view.appliers)).toEqual(['apply-b', 'apply-a']);
    expect(ids(view.conditional)).toEqual(['pair']);
    expect(ids(view.random)).toEqual(['pandemic']);
    expect(ids(view.users)).toEqual(['rely', 'pair']);
  });
});

describe('verdictOf', () => {
  it.each<[string, KeywordStats, string]>([
    ['nothing at all', stats(0, 0, 0, 0), 'no-source'],
    ['users but no source of any kind', stats(0, 0, 0, 5), 'no-source'],
    ['random sources only, nobody relies on it', stats(0, 0, 3, 0), 'only-random'],
    ['random sources only', stats(0, 0, 3, 5), 'only-random'],
    ['conditional sources only', stats(0, 2, 0, 5), 'only-conditional'],
    ['conditional sources only, nobody relies on it', stats(0, 2, 0, 0), 'only-conditional'],
    [
      'random and conditional sources: random comes first (GAME_RULES, dependency statuses)',
      stats(0, 2, 3, 5),
      'only-random',
    ],
    ['one applier, nobody relies on it', stats(1, 0, 0, 0), 'no-payoff'],
    ['an applier and weaker sources, nobody relies on it', stats(1, 2, 3, 0), 'no-payoff'],
    ['1 applier, 1 user', stats(1, 0, 0, 1), 'supported'],
    ['1 applier, 2 users: twice as many users is not scarce', stats(1, 0, 0, 2), 'supported'],
    ['1 applier, 3 users', stats(1, 0, 0, 3), 'scarce'],
    ['2 appliers, 4 users', stats(2, 0, 0, 4), 'supported'],
    ['2 appliers, 5 users', stats(2, 0, 0, 5), 'scarce'],
    ['3 appliers, 6 users', stats(3, 0, 0, 6), 'supported'],
    ['3 appliers, 7 users', stats(3, 0, 0, 7), 'scarce'],
    ['more appliers than users', stats(14, 0, 0, 3), 'supported'],
    ['the weaker sources do not make a scarce enabler less scarce', stats(1, 1, 27, 10), 'scarce'],
    ['Poisoned on the real sheet: 14 appliers, 25 users', stats(14, 1, 27, 25), 'supported'],
  ])('is %s → %s', (_situation, given, expected) => {
    expect(verdictOf(given)).toBe(expected);
  });
});

describe('keywordView: the verdict is read from what is listed', () => {
  it('says no source for a key only relied on, and no payoff for one only applied', () => {
    const traits = [trait('needs', { keywords: uses('weak') }), trait('gives', { keywords: applies('poisoned') })];

    expect(viewOf(traits, 'weak').verdict).toBe('no-source');
    expect(viewOf(traits, 'poisoned').verdict).toBe('no-payoff');
  });

  it('takes a trait that only guards against a key (resists) for neither side', () => {
    const traits = [trait('guard', { keywords: [keyword('weak', 'resists')] })];

    expect(viewOf(traits, 'weak')).toMatchObject({ stats: stats(0, 0, 0, 0), verdict: 'no-source' });
  });

  it('says scarce enabler when twice the appliers are fewer than the users', () => {
    const users = ['u1', 'u2', 'u3', 'u4', 'u5'].map((id) => trait(id, { keywords: uses('weak') }));
    const givers = ['g1', 'g2'].map((id) => trait(id, { keywords: applies('weak') }));

    expect(viewOf([...givers, ...users], 'weak').verdict).toBe('scarce');
    expect(viewOf([...givers, ...users.slice(1)], 'weak').verdict).toBe('supported');
  });

  it('counts an applier once however often it names the key', () => {
    const traits = [
      trait('gives', { keywords: [...applies('weak'), ...applies('weak')] }),
      trait('needs', { keywords: uses('weak') }),
    ];

    expect(viewOf(traits, 'weak').stats).toEqual(stats(1, 0, 0, 1));
  });

  it('says only random for a debuff with no applier and an enemy-only random source, and never for Inverted', () => {
    const traits = [
      trait('pandemic', { randomDebuff: enemyRandom }),
      trait('needs', { keywords: uses('weak', 'inverted') }),
    ];

    expect(viewOf(traits, 'weak').verdict).toBe('only-random');
    expect(viewOf(traits, 'inverted').verdict).toBe('no-source');
  });

  it('says only conditional for a debuff only the pair traits give', () => {
    const traits = [trait('pair', { keywords: uses('weak', 'poisoned'), conditionalSources: ['weak', 'poisoned'] })];

    expect(viewOf(traits, 'weak').verdict).toBe('only-conditional');
  });

  it('says only random when the random source stands beside a conditional one', () => {
    const traits = [
      trait('pandemic', { randomDebuff: enemyRandom }),
      trait('pair', { keywords: uses('weak', 'poisoned'), conditionalSources: ['weak', 'poisoned'] }),
    ];

    expect(viewOf(traits, 'weak').verdict).toBe('only-random');
  });
});

describe('keywordView: coApplied', () => {
  it('counts, for each other key, the appliers that also apply it, most first', () => {
    const traits = [
      trait('a1', { keywords: applies('weak', 'poisoned', 'barrier') }),
      trait('a2', { keywords: applies('weak', 'poisoned') }),
      trait('a3', { keywords: applies('weak', 'poisoned', 'zombies') }),
      trait('a4', { keywords: applies('weak', 'zombies') }),
      trait('elsewhere', { keywords: applies('inverted') }),
    ];

    expect(viewOf(traits, 'weak').coApplied).toEqual([
      { key: 'poisoned', count: 3 },
      { key: 'zombies', count: 2 },
      { key: 'barrier', count: 1 },
    ]);
  });

  it('breaks a tie by the order of the taxonomy, whatever the order of the traits', () => {
    const traits = [
      trait('a1', { keywords: applies('weak', 'zombies') }),
      trait('a2', { keywords: applies('weak', 'barrier') }),
      trait('a3', { keywords: applies('weak', 'poisoned') }),
    ];

    expect(viewOf(traits, 'weak').coApplied.map(({ key }) => key)).toEqual(['poisoned', 'barrier', 'zombies']);
    expect(viewOf(traits.toReversed(), 'weak').coApplied.map(({ key }) => key)).toEqual([
      'poisoned',
      'barrier',
      'zombies',
    ]);
  });

  it('never lists the key itself, an event, a mechanic or a key the taxonomy does not have', () => {
    const traits = [
      trait('a1', {
        keywords: [
          ...applies('weak'),
          keyword('attack', 'applies', 'event'),
          keyword('fused', 'applies', 'mechanic'),
          keyword('shelled', 'applies', 'buff'),
        ],
      }),
    ];

    expect(viewOf(traits, 'weak').coApplied).toEqual([]);
  });

  it('counts a trait once for a key it names twice', () => {
    const traits = [trait('a1', { keywords: [...applies('weak'), ...applies('poisoned'), ...applies('poisoned')] })];

    expect(viewOf(traits, 'weak').coApplied).toEqual([{ key: 'poisoned', count: 1 }]);
  });

  it('counts what the appliers give, not what they rely on or guard against', () => {
    const traits = [
      trait('a1', {
        keywords: [
          ...applies('weak'),
          ...uses('poisoned'),
          keyword('barrier', 'resists', 'buff'),
          keyword('zombies', undefined, 'effect'),
        ],
      }),
    ];

    expect(viewOf(traits, 'weak').coApplied).toEqual([]);
  });

  it('counts the specific appliers only: a conditional or random source has no say', () => {
    const traits = [
      trait('gives', { keywords: applies('weak') }),
      trait('pair', {
        keywords: [...uses('weak', 'poisoned'), ...applies('barrier')],
        conditionalSources: ['weak', 'poisoned'],
      }),
      trait('pandemic', { keywords: applies('zombies'), randomDebuff: enemyRandom }),
    ];

    expect(ids(viewOf(traits, 'weak').conditional)).toEqual(['pair']);
    expect(ids(viewOf(traits, 'weak').random)).toEqual(['pandemic']);
    expect(viewOf(traits, 'weak').coApplied).toEqual([]);
  });

  it('is empty for a key nobody applies', () => {
    const traits = [trait('needs', { keywords: [...uses('weak'), ...applies('poisoned')] })];

    expect(viewOf(traits, 'zombies').coApplied).toEqual([]);
  });
});

describe('keywordView: only artifact-eligible traits', () => {
  const traits = [
    trait('gives-a', { keywords: applies('weak', 'poisoned') }),
    trait('gives-b', { keywords: applies('weak', 'barrier'), material: null }),
    trait('gives-c', { keywords: applies('weak', 'barrier'), material: null }),
    trait('pandemic', { randomDebuff: enemyRandom, material: null }),
    trait('pair', { keywords: uses('weak', 'poisoned'), conditionalSources: ['weak', 'poisoned'] }),
    trait('needs-a', { keywords: uses('weak') }),
    trait('needs-b', { keywords: uses('weak'), material: null }),
    trait('needs-c', { keywords: uses('weak'), material: null }),
    trait('needs-d', { keywords: uses('weak'), material: null }),
  ];

  it('keeps every trait by default', () => {
    const everything = viewOf(traits, 'weak');

    expect(ids(everything.appliers)).toEqual(['gives-a', 'gives-b', 'gives-c']);
    expect(viewOf(traits, 'weak', { artifactOnly: false })).toEqual(everything);
  });

  it('drops the traits without material from all four lists, keeping the order of the others', () => {
    const view = viewOf(traits, 'weak', { artifactOnly: true });

    expect(ids(view.appliers)).toEqual(['gives-a']);
    expect(ids(view.conditional)).toEqual(['pair']);
    expect(ids(view.random)).toEqual([]);
    expect(ids(view.users)).toEqual(['pair', 'needs-a']);
  });

  it('works the counts, the verdict and the co-applied keys out of what is left', () => {
    expect(viewOf(traits, 'weak')).toMatchObject({
      stats: stats(3, 1, 1, 5),
      verdict: 'supported',
      coApplied: [
        { key: 'barrier', count: 2 },
        { key: 'poisoned', count: 1 },
      ],
    });
    expect(viewOf(traits, 'weak', { artifactOnly: true })).toMatchObject({
      stats: stats(1, 1, 0, 2),
      verdict: 'supported',
      coApplied: [{ key: 'poisoned', count: 1 }],
    });
  });

  it('can leave a key with no source, or with weaker ones only', () => {
    const only = [
      trait('no-material', { keywords: applies('weak'), material: null }),
      trait('pandemic', { randomDebuff: enemyRandom }),
      trait('needs', { keywords: uses('weak') }),
    ];

    expect(viewOf(only, 'weak').verdict).toBe('supported');
    expect(viewOf(only, 'weak', { artifactOnly: true }).verdict).toBe('only-random');
    expect(viewOf(only.slice(0, 1), 'weak', { artifactOnly: true }).verdict).toBe('no-source');
  });
});

describe('keywordStats', () => {
  const traits = [
    trait('gives', { keywords: applies('weak') }),
    trait('gives-without', { keywords: applies('weak', 'barrier'), material: null }),
    trait('needs', { keywords: uses('weak', 'zombies') }),
    trait('pandemic', { randomDebuff: enemyRandom, material: null }),
  ];

  it('has an entry for every key of the index, in the order of the taxonomy', () => {
    expect([...createRelationIndex(traits, taxonomy).keywordStats().keys()]).toEqual(KEYS);
    expect([...createRelationIndex([], taxonomy).keywordStats().keys()]).toEqual(KEYS);
  });

  it('gives what the view of each key says, with or without the filter', () => {
    const index = createRelationIndex(traits, taxonomy);

    for (const options of [undefined, { artifactOnly: false }, { artifactOnly: true }]) {
      const counted = index.keywordStats(options);
      for (const key of KEYS) {
        expect(counted.get(key), `${key} ${JSON.stringify(options)}`).toEqual(viewIn(index, key, options).stats);
      }
    }
  });

  it('counts after the filter', () => {
    const index = createRelationIndex(traits, taxonomy);

    expect(index.keywordStats().get('weak')).toEqual(stats(2, 0, 1, 1));
    expect(index.keywordStats({ artifactOnly: true }).get('weak')).toEqual(stats(1, 0, 0, 1));
    expect(index.keywordStats({ artifactOnly: true }).get('barrier')).toEqual(stats(0, 0, 0, 0));
  });
});

describe('keywordView: invariants', () => {
  interface TraitShape {
    readonly keywords: readonly { readonly key: string; readonly role: KeywordRole | undefined }[];
    readonly hasMaterial: boolean;
    readonly random: boolean;
    readonly conditional: readonly string[];
  }
  // Dense on purpose: few keys, mostly the roles that count, and some sources of the weaker kinds.
  const shapesArbitrary = fc.array<TraitShape>(
    fc.record({
      keywords: fc.array(
        fc.record({
          key: fc.oneof(
            { weight: 5, arbitrary: fc.constantFrom(...KEYS) },
            { weight: 1, arbitrary: fc.constantFrom('attack', 'fused', 'unknown') },
          ),
          role: fc.constantFrom<KeywordRole | undefined>('applies', 'applies', 'uses', 'uses', 'resists', undefined),
        }),
        { maxLength: 6 },
      ),
      hasMaterial: fc.boolean(),
      random: fc.boolean(),
      conditional: fc.subarray(['poisoned', 'weak'], { maxLength: 2 }),
    }),
    { maxLength: 16 },
  );
  const build = (shapes: readonly TraitShape[]): Trait[] =>
    shapes.map(({ keywords, hasMaterial, random, conditional }, position) =>
      trait(`t${position}`, {
        keywords: keywords.map(({ key, role }) => keyword(key, role, taxonomy.get(key)?.kind ?? 'debuff')),
        material: hasMaterial ? 'Ferrous Ore' : null,
        randomDebuff: random ? enemyRandom : null,
        conditionalSources: conditional,
      }),
    );
  const optionsArbitrary = fc.constantFrom<RelationOptions>({}, { artifactOnly: true });

  it('lists what the relation index lists, less the traits without material when asked', () => {
    fc.assert(
      fc.property(shapesArbitrary, optionsArbitrary, (shapes, options) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        const kept = (list: readonly Trait[]) =>
          list.filter((one) => options.artifactOnly !== true || one.material !== null);
        for (const key of index.keys) {
          const view = viewIn(index, key, options);
          const found = index.get(key);

          expect(ids(view.appliers), key).toEqual(ids(kept(found?.appliers ?? [])));
          expect(ids(view.conditional), key).toEqual(ids(kept(found?.conditional ?? [])));
          expect(ids(view.random), key).toEqual(ids(kept(found?.random ?? [])));
          expect(ids(view.users), key).toEqual(ids(kept(found?.users ?? [])));
        }
      }),
    );
  });

  it('counts the lists, reads the verdict from the counts and has the same counts as keywordStats', () => {
    fc.assert(
      fc.property(shapesArbitrary, optionsArbitrary, (shapes, options) => {
        const index = createRelationIndex(build(shapes), taxonomy);
        const counted = index.keywordStats(options);
        for (const key of index.keys) {
          const view = viewIn(index, key, options);

          expect(view.stats, key).toEqual(
            stats(view.appliers.length, view.conditional.length, view.random.length, view.users.length),
          );
          expect(view.verdict, key).toBe(verdictOf(view.stats));
          expect(counted.get(key), key).toEqual(view.stats);
        }
      }),
    );
  });

  it('finds the co-applied keys as a brute-force count does, once each, in order', () => {
    fc.assert(
      fc.property(shapesArbitrary, optionsArbitrary, (shapes, options) => {
        const index = createRelationIndex(build(shapes), taxonomy);
        for (const key of index.keys) {
          const view = viewIn(index, key, options);
          const expected = index.keys
            .filter((other) => other !== key)
            .map((other) => ({
              key: other,
              count: view.appliers.filter((one) =>
                one.keywords.some((hit) => hit.key === other && hit.role === 'applies'),
              ).length,
            }))
            .filter(({ count }) => count > 0)
            .toSorted((a, b) => b.count - a.count || index.keys.indexOf(a.key) - index.keys.indexOf(b.key));

          expect(view.coApplied, key).toEqual(expected);
        }
      }),
    );
  });

  it('does not depend on the order the traits come in, except for the order of the lists', () => {
    fc.assert(
      fc.property(shapesArbitrary, optionsArbitrary, (shapes, options) => {
        const traits = build(shapes);
        const forward = createRelationIndex(traits, taxonomy);
        const backward = createRelationIndex(traits.toReversed(), taxonomy);
        for (const key of forward.keys) {
          const [first, second] = [viewIn(forward, key, options), viewIn(backward, key, options)];

          expect(second.stats, key).toEqual(first.stats);
          expect(second.verdict, key).toBe(first.verdict);
          expect(second.coApplied, key).toEqual(first.coApplied);
        }
      }),
    );
  });
});
