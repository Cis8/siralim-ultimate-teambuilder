import {
  createMemoryTraitRepository,
  createRelationIndex,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  initialExploreState,
  taxonomy,
  type RelationIndex,
  type SearchService,
  type Trait,
} from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the relation index (Phase 2, M12) reads from the dataset, on the pinned snapshot of the compendium, v2.0.

const DEBUFFS = taxonomy.ofKind('debuff');
const DEPENDENCY_KEYS = [...DEBUFFS, ...taxonomy.ofKind('buff'), ...taxonomy.ofKind('effect')].map(({ key }) => key);
const RANDOMIZABLE = DEBUFFS.filter(({ canBeRandomlyApplied }) => canBeRandomlyApplied).map(({ key }) => key);

describe('the relation index on the compendium v2.0', () => {
  let traits: readonly Trait[];
  let index: RelationIndex;
  let service: SearchService;

  const names = (list: readonly Trait[] | undefined) => list?.map(({ name }) => name).toSorted();
  const relations = (key: string) => {
    const found = index.get(key);
    if (found === undefined) throw new Error(`the index has no key "${key}"`);
    return found;
  };

  beforeAll(async () => {
    const built = await buildRealSheet();
    traits = built.traits;
    index = createRelationIndex(traits, taxonomy);
    service = await createSearchService(
      createMemoryTraitRepository({
        schemaVersion: DATASET_SCHEMA_VERSION,
        datasetVersion: built.datasetVersion,
        traits,
      }),
    );
  });

  it('has the 20 debuffs, 18 buffs and 4 effects, and nothing else', () => {
    expect(DEPENDENCY_KEYS).toHaveLength(42);
    expect(index.keys).toEqual(DEPENDENCY_KEYS);
    expect(index.get('attack')).toBeUndefined();
    expect(index.get('fused')).toBeUndefined();
  });

  describe('random sources (GAME_RULES R5, R8)', () => {
    const enemyOnly = () => traits.filter((trait) => trait.randomDebuff?.target === 'enemy');

    it('has 27 traits that afflict a random debuff on enemies, and each is a random source of all 18 debuffs that can be random', () => {
      expect(enemyOnly()).toHaveLength(27);
      expect(RANDOMIZABLE).toHaveLength(18);
      for (const key of RANDOMIZABLE) {
        expect(names(relations(key).random), key).toEqual(names(enemyOnly()));
      }
    });

    it('never has one for Inverted or Mania, nor for a buff or an effect', () => {
      const others = index.keys.filter((key) => !RANDOMIZABLE.includes(key));

      expect(others).toHaveLength(24);
      expect(others).toContain('inverted');
      expect(others).toContain('mania');
      for (const key of others) expect(relations(key).random, key).toEqual([]);
    });

    it('leaves out Going Mad, Dusty Struggle and Glitch In The System, whose random debuff lands on the party', () => {
      const everyRandomSource = new Set(index.keys.flatMap((key) => relations(key).random.map(({ name }) => name)));

      for (const name of ['Going Mad', 'Dusty Struggle', 'Glitch In The System']) {
        expect(everyRandomSource.has(name), name).toBe(false);
      }
    });

    it('lists Pandemic, Grim Ailment and Flubris’s Entrapment, the last two with the condition they work under', () => {
      const poisoned = relations('poisoned').random;
      const activation = (name: string) => poisoned.find((trait) => trait.name === name)?.randomDebuff?.activation;

      expect(activation('Pandemic')).toBe('unconditional');
      expect(activation('Grim Ailment')).toBe('conditional');
      expect(activation("Flubris's Entrapment")).toBe('conditional');
    });

    it('lists none of them among the appliers: none names a debuff it applies', () => {
      const random = new Set(enemyOnly().map(({ id }) => id));

      for (const key of RANDOMIZABLE) {
        expect(
          relations(key).appliers.filter(({ id }) => random.has(id)),
          key,
        ).toEqual([]);
      }
    });
  });

  describe('conditional sources (GAME_RULES R10)', () => {
    it('has the four pair traits, each a conditional source of its two debuffs and of nothing else', () => {
      const conditional = new Map<string, string[]>();
      for (const key of index.keys) {
        for (const { name } of relations(key).conditional)
          conditional.set(name, [...(conditional.get(name) ?? []), key]);
      }

      expect(Object.fromEntries([...conditional].map(([name, keys]) => [name, keys.toSorted()]))).toEqual({
        'Flesh Rot': ['vulnerable', 'weak'],
        'Here to Die': ['bleeding', 'poisoned'],
        'Scared Stiff': ['feared', 'snared'],
        Kindling: ['bleeding', 'burning'],
      });
    });

    it('relies on both debuffs of its pair without applying either by name', () => {
      for (const name of ['Flesh Rot', 'Here to Die', 'Scared Stiff', 'Kindling']) {
        const pair = traits.find((trait) => trait.name === name);
        expect(pair?.conditionalSources, name).toHaveLength(2);
        for (const key of pair?.conditionalSources ?? []) {
          expect(names(relations(key).users), `${name} relies on ${key}`).toContain(name);
          expect(names(relations(key).appliers), `${name} does not apply ${key}`).not.toContain(name);
        }
      }
    });
  });

  describe('appliers and users', () => {
    it('agree with the search: `applies:` and `uses:` find as many traits for every key', () => {
      for (const key of DEPENDENCY_KEYS) {
        expect(relations(key).appliers.length, `applies:${key}`).toBe(
          service.countMatches(initialExploreState, `applies:${key}`),
        );
        expect(relations(key).users.length, `uses:${key}`).toBe(
          service.countMatches(initialExploreState, `uses:${key}`),
        );
      }
    });

    it('has a handful of appliers for a debuff and a few more users for the commonest ones', () => {
      expect([relations('poisoned').appliers.length, relations('poisoned').users.length]).toEqual([14, 25]);
      expect([relations('vulnerable').appliers.length, relations('vulnerable').users.length]).toEqual([8, 6]);
      expect([relations('mania').appliers.length, relations('mania').users.length]).toEqual([3, 7]);
    });
  });

  describe('invariants', () => {
    it('lists no trait twice in a list, nor under two kinds of source of one key', () => {
      for (const key of index.keys) {
        const { appliers, conditional, random, users } = relations(key);
        const sources = [...appliers, ...conditional, ...random].map(({ id }) => id);

        expect(new Set(sources).size, key).toBe(sources.length);
        expect(new Set(users.map(({ id }) => id)).size, key).toBe(users.length);
      }
    });

    it('lists every trait in the order of the dataset', () => {
      const position = new Map(traits.map(({ id }, at) => [id, at]));

      for (const key of index.keys) {
        const { appliers, conditional, random, users } = relations(key);
        for (const list of [appliers, conditional, random, users]) {
          const at = list.map(({ id }) => position.get(id) ?? -1);
          expect(at, key).toEqual(at.toSorted((a, b) => a - b));
        }
      }
    });
  });
});
