import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { KeywordHit, KeywordKind, KeywordRole, RandomDebuffSource, Trait } from '../model/trait';
import { buff, debuff, effect, event, flag, mechanic } from '../taxonomy/entries';
import { createTaxonomy } from '../taxonomy/registry';
import { createRelationIndex } from './relation-index';

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

function keyword(key: string, role: KeywordRole | undefined, kind: KeywordKind = 'debuff'): KeywordHit {
  return role === undefined ? { key, kind, span: [0, key.length] } : { key, kind, role, span: [0, key.length] };
}

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

const ids = (traits: readonly Trait[] | undefined) => traits?.map(({ id }) => id);

describe('createRelationIndex: the keys', () => {
  it('has the buffs, debuffs and effects of the taxonomy, in its order', () => {
    expect(createRelationIndex([], taxonomy).keys).toEqual(['poisoned', 'weak', 'inverted', 'barrier', 'zombies']);
  });

  it('has no mechanic, no flag and no event: none of them can be a dependency (GAME_RULES R12)', () => {
    const index = createRelationIndex(
      [trait('a', { keywords: [keyword('attack', 'applies', 'event'), keyword('fused', undefined, 'mechanic')] })],
      taxonomy,
    );

    expect(index.get('attack')).toBeUndefined();
    expect(index.get('fused')).toBeUndefined();
    expect(index.get('no stack')).toBeUndefined();
  });

  it('knows no key the taxonomy does not, whatever kind the trait gives it', () => {
    const index = createRelationIndex([trait('a', { keywords: [keyword('shelled', 'applies', 'buff')] })], taxonomy);

    expect(index.get('shelled')).toBeUndefined();
    expect(index.keys).not.toContain('shelled');
  });

  it('has every key, empty, when no trait mentions it', () => {
    const index = createRelationIndex([], taxonomy);

    for (const key of index.keys) {
      expect(index.get(key), key).toEqual({ key, appliers: [], conditional: [], random: [], users: [] });
    }
  });
});

describe('createRelationIndex: appliers and users', () => {
  it('lists the traits that apply a key as its appliers and the traits that rely on it as its users', () => {
    const index = createRelationIndex(
      [
        trait('gives', { keywords: [keyword('poisoned', 'applies')] }),
        trait('needs', { keywords: [keyword('poisoned', 'uses')] }),
        trait('other', { keywords: [keyword('weak', 'applies')] }),
      ],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.appliers)).toEqual(['gives']);
    expect(ids(index.get('poisoned')?.users)).toEqual(['needs']);
    expect(ids(index.get('weak')?.appliers)).toEqual(['other']);
  });

  it('works for buffs and effects as it does for debuffs', () => {
    const index = createRelationIndex(
      [
        trait('shields', { keywords: [keyword('barrier', 'applies', 'buff')] }),
        trait('raises', { keywords: [keyword('zombies', 'uses', 'effect')] }),
      ],
      taxonomy,
    );

    expect(ids(index.get('barrier')?.appliers)).toEqual(['shields']);
    expect(ids(index.get('zombies')?.users)).toEqual(['raises']);
  });

  it('lists a trait that applies and relies on a key on both sides', () => {
    const index = createRelationIndex(
      [trait('both', { keywords: [keyword('poisoned', 'applies'), keyword('poisoned', 'uses')] })],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.appliers)).toEqual(['both']);
    expect(ids(index.get('poisoned')?.users)).toEqual(['both']);
  });

  it('lists a trait once however many times its text mentions the key', () => {
    const index = createRelationIndex(
      [trait('twice', { keywords: [keyword('poisoned', 'applies'), keyword('poisoned', 'applies')] })],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.appliers)).toEqual(['twice']);
  });

  it('keeps the order of the traits it was given', () => {
    const index = createRelationIndex(
      ['c', 'a', 'b'].map((id) => trait(id, { keywords: [keyword('poisoned', 'applies')] })),
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.appliers)).toEqual(['c', 'a', 'b']);
  });

  it('leaves out a trait that only guards against the key: protection is not a dependency (GAME_RULES R9)', () => {
    const index = createRelationIndex([trait('immune', { keywords: [keyword('poisoned', 'resists')] })], taxonomy);

    expect(index.get('poisoned')).toEqual({ key: 'poisoned', appliers: [], conditional: [], random: [], users: [] });
  });
});

describe('createRelationIndex: conditional sources (GAME_RULES R10)', () => {
  it('lists the keys of `conditionalSources` as conditional, not as appliers', () => {
    const index = createRelationIndex(
      [
        trait('pair', {
          keywords: [keyword('poisoned', 'uses'), keyword('weak', 'uses')],
          conditionalSources: ['poisoned', 'weak'],
        }),
      ],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.conditional)).toEqual(['pair']);
    expect(ids(index.get('weak')?.conditional)).toEqual(['pair']);
    expect(index.get('poisoned')?.appliers).toEqual([]);
    expect(ids(index.get('poisoned')?.users)).toEqual(['pair']);
  });

  it('lists a trait that also applies the key as an applier only: the strongest source wins', () => {
    const index = createRelationIndex(
      [trait('both', { keywords: [keyword('poisoned', 'applies')], conditionalSources: ['poisoned', 'weak'] })],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.appliers)).toEqual(['both']);
    expect(index.get('poisoned')?.conditional).toEqual([]);
    expect(ids(index.get('weak')?.conditional)).toEqual(['both']);
  });

  it('ignores a conditional source of a key that is no dependency or that the taxonomy does not know', () => {
    const index = createRelationIndex([trait('odd', { conditionalSources: ['attack', 'fused', 'shelled'] })], taxonomy);

    expect(index.keys.flatMap((key) => index.get(key)?.conditional ?? [])).toEqual([]);
  });
});

describe('createRelationIndex: random sources (GAME_RULES R5, R8)', () => {
  const randomizable = ['poisoned', 'weak'];

  it('lists a trait that afflicts a random debuff on enemies as a random source of every debuff that can be random', () => {
    const index = createRelationIndex([trait('pandemic', { randomDebuff: enemyRandom })], taxonomy);

    for (const key of randomizable) expect(ids(index.get(key)?.random), key).toEqual(['pandemic']);
  });

  it('never lists a random source for a debuff the sources say cannot be applied at random', () => {
    const index = createRelationIndex([trait('pandemic', { randomDebuff: enemyRandom })], taxonomy);

    expect(index.get('inverted')?.random).toEqual([]);
  });

  it('never lists a random source for a buff or an effect: a random debuff is a debuff', () => {
    const index = createRelationIndex([trait('pandemic', { randomDebuff: enemyRandom })], taxonomy);

    expect(index.get('barrier')?.random).toEqual([]);
    expect(index.get('zombies')?.random).toEqual([]);
  });

  it('leaves out the traits whose random debuff lands on the party: only enemies count', () => {
    const index = createRelationIndex(
      [
        trait('going-mad', { randomDebuff: { target: 'self_or_allies', activation: 'unconditional' } }),
        trait('glitch', { randomDebuff: { target: 'both', activation: 'unconditional' } }),
      ],
      taxonomy,
    );

    expect(index.get('poisoned')?.random).toEqual([]);
  });

  it('keeps a random source that works only under a condition: the trait says so, the index does not hide it', () => {
    const conditional = trait('grim', { randomDebuff: { target: 'enemy', activation: 'conditional', note: 'x' } });
    const index = createRelationIndex([conditional], taxonomy);

    expect(index.get('poisoned')?.random).toEqual([conditional]);
  });

  it('lists a random source as an applier only for a debuff it applies by name', () => {
    const index = createRelationIndex(
      [trait('named', { randomDebuff: enemyRandom, keywords: [keyword('poisoned', 'applies')] })],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.appliers)).toEqual(['named']);
    expect(index.get('poisoned')?.random).toEqual([]);
    expect(ids(index.get('weak')?.random)).toEqual(['named']);
  });

  it('lists a trait that is a conditional source and a random one as conditional only', () => {
    const index = createRelationIndex(
      [trait('both', { randomDebuff: enemyRandom, conditionalSources: ['poisoned'] })],
      taxonomy,
    );

    expect(ids(index.get('poisoned')?.conditional)).toEqual(['both']);
    expect(index.get('poisoned')?.random).toEqual([]);
    expect(ids(index.get('weak')?.random)).toEqual(['both']);
  });
});

describe('createRelationIndex: invariants', () => {
  interface TraitShape {
    readonly keywords: readonly { readonly key: string; readonly role: KeywordRole | undefined }[];
    readonly conditionalSources: readonly string[];
    readonly randomDebuff: RandomDebuffSource | null;
  }
  const keywordArbitrary = fc.record({
    key: fc.constantFrom('poisoned', 'weak', 'inverted', 'barrier', 'zombies', 'attack', 'fused', 'unknown'),
    role: fc.constantFrom<KeywordRole | undefined>('applies', 'uses', 'resists', undefined),
  });
  const traitsArbitrary = fc.array<TraitShape>(
    fc.record({
      keywords: fc.array(keywordArbitrary, { maxLength: 4 }),
      conditionalSources: fc.array(fc.constantFrom('poisoned', 'weak', 'barrier', 'attack', 'unknown'), {
        maxLength: 3,
      }),
      randomDebuff: fc.constantFrom<RandomDebuffSource | null>(null, enemyRandom, {
        target: 'both',
        activation: 'unconditional',
      }),
    }),
    { maxLength: 12 },
  );
  const build = (shapes: readonly TraitShape[]): Trait[] =>
    shapes.map(({ keywords, conditionalSources, randomDebuff }, position) =>
      trait(`t${position}`, {
        keywords: keywords.map(({ key, role }) => keyword(key, role, taxonomy.get(key)?.kind ?? 'debuff')),
        conditionalSources,
        randomDebuff,
      }),
    );

  it('lists no trait twice in a list, and no trait under two kinds of source of the same key', () => {
    fc.assert(
      fc.property(traitsArbitrary, (shapes) => {
        const index = createRelationIndex(build(shapes), taxonomy);
        for (const key of index.keys) {
          const relations = index.get(key);
          const sources = [relations?.appliers, relations?.conditional, relations?.random].flatMap(
            (list) => ids(list) ?? [],
          );
          expect(new Set(sources).size, key).toBe(sources.length);
          expect(new Set(ids(relations?.users)).size, key).toBe(relations?.users.length);
        }
      }),
    );
  });

  it('lists a trait as a user only of a key it relies on, and as an applier only of one it applies', () => {
    fc.assert(
      fc.property(traitsArbitrary, (shapes) => {
        const traits = build(shapes);
        const index = createRelationIndex(traits, taxonomy);
        const mentions = (candidate: Trait | undefined, key: string, role: KeywordRole) =>
          candidate?.keywords.some((hit) => hit.key === key && hit.role === role) === true;
        for (const key of index.keys) {
          for (const user of index.get(key)?.users ?? []) expect(mentions(user, key, 'uses'), key).toBe(true);
          for (const applier of index.get(key)?.appliers ?? [])
            expect(mentions(applier, key, 'applies'), key).toBe(true);
        }
      }),
    );
  });

  it('keeps the order it was given: the traits in reverse make every list reverse', () => {
    fc.assert(
      fc.property(traitsArbitrary, (shapes) => {
        const traits = build(shapes);
        const forward = createRelationIndex(traits, taxonomy);
        const backward = createRelationIndex(traits.toReversed(), taxonomy);
        for (const key of forward.keys) {
          for (const side of ['appliers', 'conditional', 'random', 'users'] as const) {
            expect(ids(backward.get(key)?.[side]), `${key} ${side}`).toEqual(
              ids(forward.get(key)?.[side])?.toReversed(),
            );
          }
        }
      }),
    );
  });
});
