import {
  createMemoryTraitRepository,
  createRelationIndex,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  initialExploreState,
  taxonomy,
  type Alternative,
  type KeywordActor,
  type RelatedTrait,
  type RelationIndex,
  type RelationOptions,
  type RelationSide,
  type SameFamily,
  type SameTrigger,
  type SearchService,
  type Trait,
  type TraitRelations,
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

  const enemyOnly = () => traits.filter((trait) => trait.randomDebuff?.target === 'enemy');

  describe('random sources (GAME_RULES R5, R8)', () => {
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

  const traitNamed = (name: string): Trait => {
    const found = traits.find((trait) => trait.name === name);
    if (found === undefined) throw new Error(`the sheet has no trait "${name}"`);
    return found;
  };

  describe('what enables a trait and what it enables', () => {
    const relationsOf = (trait: Trait, options?: RelationOptions, from: RelationIndex = index): TraitRelations => {
      const found = from.relationsOf(trait.id, options);
      if (found === undefined) throw new Error(`the index has no trait "${trait.name}"`);
      return found;
    };
    const entriesOf = (side: RelationSide): RelatedTrait[] => [
      ...side.several,
      ...side.single.flatMap(({ entries }) => entries),
    ];
    const sidesOf = (trait: Trait, options?: RelationOptions) => {
      const { enabledBy, enables } = relationsOf(trait, options);
      return [enabledBy, enables] as const;
    };
    const idsOf = (side: RelationSide) => entriesOf(side).map(({ trait }) => trait.id);
    /** The keys of the index a trait mentions with the role, once each. */
    const keysWith = (trait: Trait, role: 'applies' | 'uses') => [
      ...new Set(
        trait.keywords.filter((hit) => hit.role === role && index.get(hit.key) !== undefined).map(({ key }) => key),
      ),
    ];
    const randomAtTheEnd = (entries: readonly RelatedTrait[]) => {
      const first = entries.findIndex(({ strength }) => strength === 'random');
      return first === -1 || entries.slice(first).every(({ strength }) => strength === 'random');
    };
    const linksBetween = (focus: string, other: string) =>
      entriesOf(relationsOf(traitNamed(focus)).enabledBy).find(({ trait }) => trait.name === other)?.links;

    it('lists a trait that applies Weak and Vulnerable once, first, with two links, for a trait that relies on both (criterion 4)', () => {
      for (const name of ['Sin and Sentence', 'Flesh Rot']) {
        const focus = traitNamed(name);
        const { enabledBy } = relationsOf(focus);
        const listed = entriesOf(enabledBy).filter(({ trait }) => trait.name === 'Master of Abominations');

        expect(keysWith(focus, 'uses'), name).toEqual(expect.arrayContaining(['weak', 'vulnerable']));
        expect(listed, name).toHaveLength(1);
        expect(listed[0]?.score, name).toBe(2);
        expect(listed[0]?.links.map(({ key }) => key).toSorted(), name).toEqual(['vulnerable', 'weak']);
        expect(enabledBy.several[0]?.trait.name, name).toBe('Master of Abominations');
      }
    });

    it('lists each random source in the lane of every debuff a trait relies on that can be random, after the others (criterion 5)', () => {
      const randomSources = enemyOnly().map(({ id }) => id);

      for (const key of RANDOMIZABLE) {
        for (const focus of relations(key).users) {
          const { enabledBy } = relationsOf(focus);
          const linkedByRandom = entriesOf(enabledBy)
            .filter(({ links }) => links.some((link) => link.key === key && link.strength === 'random'))
            .map(({ trait }) => trait.id);

          expect(linkedByRandom.toSorted(), `${focus.name} through ${key}`).toEqual(
            randomSources.filter((id) => id !== focus.id).toSorted(),
          );
          expect(randomAtTheEnd(enabledBy.several), `${focus.name}: several`).toBe(true);
          const lane = enabledBy.single.find((candidate) => candidate.key === key);
          expect(randomAtTheEnd(lane?.entries ?? []), `${focus.name}: ${key}`).toBe(true);
        }
      }
    });

    it('gives a random source a random link for exactly the keys that can be random: any other link it has, it applies by name', () => {
      const random = new Set(enemyOnly().map(({ id }) => id));
      const byName = new Set<string>();

      for (const focus of traits) {
        for (const { trait, links } of entriesOf(relationsOf(focus).enabledBy)) {
          if (!random.has(trait.id)) continue;
          for (const link of links) {
            expect(link.strength === 'random', `${trait.name} for ${focus.name} through ${link.key}`).toBe(
              RANDOMIZABLE.includes(link.key),
            );
            if (link.strength === 'specific') byName.add(`${trait.name}: ${link.key}`);
          }
        }
      }
      // Zantai's Envy afflicts a random debuff and gives Mega Magic by name: the one trait that is both.
      expect([...byName]).toEqual(["Zantai's Envy: mega magic"]);
    });

    it('never lists Going Mad, Dusty Struggle or Glitch In The System, whose random debuff lands on the party', () => {
      const onTheParty = new Set(['Going Mad', 'Dusty Struggle', 'Glitch In The System']);
      const listed = traits.flatMap((focus) =>
        sidesOf(focus).flatMap((side) =>
          entriesOf(side)
            .filter(({ trait }) => onTheParty.has(trait.name))
            .map(({ trait }) => `${trait.name} for ${focus.name}`),
        ),
      );

      expect(listed).toEqual([]);
    });

    it('lists the pair traits that share a debuff as conditional sources of each other: Here to Die and Kindling share Bleeding', () => {
      expect(linksBetween('Here to Die', 'Kindling')).toEqual([{ key: 'bleeding', strength: 'conditional' }]);
      expect(linksBetween('Kindling', 'Here to Die')).toEqual([{ key: 'bleeding', strength: 'conditional' }]);
    });

    it('lists Flesh Rot, a conditional source of Weak and Vulnerable, after the traits that apply them and before the random ones', () => {
      const { several } = relationsOf(traitNamed('Sin and Sentence')).enabledBy;
      const strengths = several.map(({ strength }) => strength);
      const fleshRot = several.findIndex(({ trait }) => trait.name === 'Flesh Rot');

      expect(fleshRot).toBe(strengths.lastIndexOf('specific') + 1);
      expect(fleshRot).toBe(strengths.indexOf('random') - 1);
      expect(several[fleshRot]?.links).toEqual([
        { key: 'weak', strength: 'conditional' },
        { key: 'vulnerable', strength: 'conditional' },
      ]);
    });

    it('has an empty Enables side for the pair traits: they apply nothing by name', () => {
      for (const name of ['Flesh Rot', 'Here to Die', 'Scared Stiff', 'Kindling']) {
        const pair = traitNamed(name);

        expect(keysWith(pair, 'applies'), name).toEqual([]);
        expect(relationsOf(pair).enables.count, name).toBe(0);
      }
    });

    it('lists, for every trait, exactly the other traits that give what it relies on and that rely on what it applies', () => {
      for (const focus of traits) {
        const [enabledBy, enables] = sidesOf(focus);
        const givers = (key: string) => {
          const { appliers, conditional, random } = relations(key);
          return [...appliers, ...conditional, ...random];
        };
        const expectedEnabledBy = new Set(
          keysWith(focus, 'uses')
            .flatMap(givers)
            .map(({ id }) => id),
        );
        const expectedEnables = new Set(
          keysWith(focus, 'applies')
            .flatMap((key) => relations(key).users)
            .map(({ id }) => id),
        );
        expectedEnabledBy.delete(focus.id);
        expectedEnables.delete(focus.id);

        expect(idsOf(enabledBy).toSorted(), `enabled by, ${focus.name}`).toEqual([...expectedEnabledBy].toSorted());
        expect(idsOf(enables).toSorted(), `enables, ${focus.name}`).toEqual([...expectedEnables].toSorted());
      }
    });

    it('lists a trait once on a side and ranks both lanes by tier, then by the number of links', () => {
      const tier = ['specific', 'conditional', 'random'];
      for (const focus of traits) {
        for (const side of sidesOf(focus)) {
          const listed = idsOf(side);
          expect(new Set(listed).size, focus.name).toBe(listed.length);
          expect(side.count, focus.name).toBe(listed.length);
          for (const entries of [side.several, ...side.single.map((lane) => lane.entries)]) {
            const rank = entries.map(({ strength, score }) => [tier.indexOf(strength), -score] as const);
            expect(rank, focus.name).toEqual(
              rank.toSorted(([tierA, scoreA], [tierB, scoreB]) => tierA - tierB || scoreA - scoreB),
            );
          }
        }
      }
    });

    it('is symmetric: A enables B through a key exactly when B is enabled by A through it by name', () => {
      const enabledByEdges = new Set(
        traits.flatMap((target) =>
          entriesOf(relationsOf(target).enabledBy).flatMap(({ trait, links }) =>
            links
              .filter(({ strength }) => strength === 'specific')
              .map(({ key }) => `${trait.id} > ${target.id} through ${key}`),
          ),
        ),
      );
      const enablesEdges = new Set(
        traits.flatMap((source) =>
          entriesOf(relationsOf(source).enables).flatMap(({ trait, links }) =>
            links.map(({ key }) => `${source.id} > ${trait.id} through ${key}`),
          ),
        ),
      );

      expect(enabledByEdges.size).toBeGreaterThan(1000);
      expect([...enablesEdges].filter((edge) => !enabledByEdges.has(edge))).toEqual([]);
      expect([...enabledByEdges].filter((edge) => !enablesEdges.has(edge))).toEqual([]);
    });

    it('gives the same lists whatever the order of the dataset', () => {
      const describeEntry = ({ trait, links }: RelatedTrait) =>
        `${trait.id} ${links.map(({ key, strength }) => `${key}/${strength}`).join(' ')}`;
      const shape = ({ several, single, unmet, count }: RelationSide) => ({
        several: several.map(describeEntry),
        single: single.map(({ key, entries }) => [key, entries.map(describeEntry)]),
        unmet,
        count,
      });
      const reversed = createRelationIndex(traits.toReversed(), taxonomy);

      for (const focus of traits) {
        for (const options of [{}, { artifactOnly: true }]) {
          const [enabledBy, enables] = sidesOf(focus, options);
          const other = relationsOf(focus, options, reversed);
          expect(shape(other.enabledBy), `enabled by, ${focus.name}`).toEqual(shape(enabledBy));
          expect(shape(other.enables), `enables, ${focus.name}`).toEqual(shape(enables));
        }
      }
    });

    it('with the artifact filter lists exactly the traits that have material, and still reads a focus that has none', () => {
      const hasMaterial = ({ trait }: RelatedTrait) => trait.material !== null;
      let dropped = 0;

      for (const focus of traits) {
        const [wholeEnabledBy, wholeEnables] = sidesOf(focus);
        const [enabledBy, enables] = sidesOf(focus, { artifactOnly: true });
        for (const [kept, whole] of [
          [enabledBy, wholeEnabledBy],
          [enables, wholeEnables],
        ] as const) {
          dropped += whole.count - kept.count;
          expect(idsOf(kept).toSorted(), focus.name).toEqual(
            entriesOf(whole)
              .filter(hasMaterial)
              .map(({ trait }) => trait.id)
              .toSorted(),
          );
        }
      }

      expect(dropped).toBe(216);
      const withoutMaterial = traits.filter(
        (trait) => trait.material === null && relationsOf(trait).enabledBy.count > 0,
      );
      expect(withoutMaterial).not.toEqual([]);
      for (const trait of withoutMaterial) {
        expect(relationsOf(trait, { artifactOnly: true }).enabledBy.count, trait.name).toBeGreaterThan(0);
      }
    });
  });

  describe('alternatives, the same trigger and the same family (SPEC §8.4)', () => {
    const OPTIONS: readonly RelationOptions[] = [{}, { artifactOnly: true }];
    const found = <Found>(list: Found | undefined, trait: Trait): Found => {
      if (list === undefined) throw new Error(`the index has no trait "${trait.name}"`);
      return list;
    };
    const alternativesOf = (
      trait: Trait,
      options?: RelationOptions,
      from: RelationIndex = index,
    ): readonly Alternative[] => found(from.alternativesOf(trait.id, options), trait);
    const sameTriggerOf = (trait: Trait, options?: RelationOptions, from: RelationIndex = index): SameTrigger =>
      found(from.sameTriggerOf(trait.id, options), trait);
    const sameFamilyOf = (trait: Trait, options?: RelationOptions, from: RelationIndex = index): SameFamily =>
      found(from.sameFamilyOf(trait.id, options), trait);
    const inCase = (name: string) => name.toLowerCase();
    const hasMaterial = (trait: Trait) => trait.material !== null;
    /** Reads something of a trait once: the oracles below look at every pair of the 1,780 traits. */
    const memoised = <Value>(read: (trait: Trait) => Value) => {
      const cache = new Map<string, Value>();
      return (trait: Trait): Value => {
        const known = cache.get(trait.id);
        if (known !== undefined) return known;
        const value = read(trait);
        cache.set(trait.id, value);
        return value;
      };
    };

    describe('alternatives', () => {
      const sentence = ({ trait, shared }: Alternative) =>
        `${trait.name}: ${shared.map(({ role, key }) => `${role} ${key}`).join(', ')}`;
      /** What a trait gives or relies on among the 42 keys, as a tie each (a role and a key), in the order it names them. */
      const tiesOf = memoised((trait) => [
        ...new Set(
          trait.keywords
            .filter(({ role, key }) => (role === 'applies' || role === 'uses') && DEPENDENCY_KEYS.includes(key))
            .map(({ role, key }) => `${role} ${key}`),
        ),
      ]);

      it('lists for a trait that relies on Weak and Vulnerable the one that relies on both first, then those that rely on one', () => {
        expect(alternativesOf(traitNamed('Sin and Sentence')).map(sentence)).toEqual([
          'Flesh Rot: uses weak, uses vulnerable',
          'Cloudy Constitution: uses vulnerable',
          'Frailty: uses vulnerable',
          'Manipulate Fear: uses weak',
          'Quell: uses vulnerable',
          'Wretchedness: uses vulnerable',
        ]);
      });

      it('lists for a mastery that applies Weak and Vulnerable the creatures that apply them', () => {
        expect(alternativesOf(traitNamed('Master of Abominations')).map(sentence)).toEqual([
          'Cannon Shot: applies vulnerable',
          'Cloudy Constitution: applies vulnerable',
          'Crunch: applies vulnerable',
          'Curse of the Outspoken: applies vulnerable',
          'Scourge: applies weak',
          'Steel Eater: applies vulnerable',
          'Turn to Gray: applies vulnerable',
          'Wrecking Ball: applies vulnerable',
        ]);
      });

      it('has nobody for a trait that gives and relies on no buff, debuff or effect', () => {
        const alone = traits.filter((trait) => tiesOf(trait).length === 0);

        expect(alone.length).toBeGreaterThan(1000);
        for (const trait of alone) expect(alternativesOf(trait), trait.name).toEqual([]);
      });

      it('lists, for every trait, exactly the other traits that share a key and a role with it, with the ties they share', () => {
        for (const focus of traits) {
          const own = tiesOf(focus);
          const expected = traits
            .filter(({ id }) => id !== focus.id)
            .map((other) => [other.id, own.filter((tie) => tiesOf(other).includes(tie))] as const)
            .filter(([, shared]) => shared.length > 0)
            .toSorted(([a], [b]) => (a < b ? -1 : 1));
          const listed = alternativesOf(focus)
            .map(({ trait, shared }) => [trait.id, shared.map(({ role, key }) => `${role} ${key}`)] as const)
            .toSorted(([a], [b]) => (a < b ? -1 : 1));

          expect(listed, focus.name).toEqual(expected);
        }
      });

      it('ranks by the number of keys shared, then by name regardless of case', () => {
        for (const focus of traits) {
          const list = alternativesOf(focus);
          for (const [at, entry] of list.entries()) {
            const before = list[at - 1];
            if (before === undefined) continue;
            const key = (alternative: Alternative) =>
              [-alternative.shared.length, inCase(alternative.trait.name)] as const;
            const [countBefore, nameBefore] = key(before);
            const [count, name] = key(entry);

            expect(countBefore < count || (countBefore === count && nameBefore <= name), focus.name).toBe(true);
          }
        }
      });
    });

    describe('same trigger', () => {
      const events = (trait: Trait, event: string) =>
        trait.keywords.filter((hit) => hit.kind === 'event' && hit.role === 'uses' && hit.key === event);
      const actorsOf = (trait: Trait, event: string) => events(trait, event).map(({ actor }) => actor);
      /** The events a trait waits for, in the order it names them, with who does each, mention by mention. */
      const waitsOf = memoised((trait) => {
        const waits = new Map<string, (KeywordActor | undefined)[]>();
        for (const { key } of trait.keywords.filter((hit) => hit.kind === 'event' && hit.role === 'uses')) {
          waits.set(key, actorsOf(trait, key));
        }
        return waits;
      });
      const canBeTheSame = (a: KeywordActor | undefined, b: KeywordActor | undefined) =>
        a === undefined || b === undefined || a === 'any' || b === 'any' || a === b;
      const sharedBy = (focus: Trait, other: Trait) =>
        [...waitsOf(focus)]
          .filter(([event, actors]) =>
            (waitsOf(other).get(event) ?? []).some((theirs) => actors.some((ours) => canBeTheSame(ours, theirs))),
          )
          .map(([event]) => event);
      const namesOf = (list: SameTrigger) => list.entries.map(({ trait }) => trait.name);

      it('has no trigger and lists nobody for a trait that waits for no event: 531 of the 1,780', () => {
        const without = traits.filter((trait) => sameTriggerOf(trait).triggers.length === 0);

        expect(without).toHaveLength(531);
        expect(without.map((trait) => waitsOf(trait).size)).toEqual(without.map(() => 0));
        expect(sameTriggerOf(traitNamed('Master of Abominations'))).toEqual({ triggers: [], entries: [] });
        for (const trait of without) expect(sameTriggerOf(trait).entries, trait.name).toEqual([]);
      });

      it('lists for a trait that waits for its creature to attack the traits that wait for an attack by this creature, nobody named or any creature', () => {
        const focus = traitNamed('Sin and Sentence');
        const list = sameTriggerOf(focus);
        const onlyOthers = traits.filter((trait) => {
          const actors = actorsOf(trait, 'attack');
          return actors.length > 0 && actors.every((actor) => actor === 'ally' || actor === 'enemy');
        });

        expect(list.triggers).toEqual(['attack']);
        expect(namesOf(list)).toContain('Abation');
        expect(list.entries.every(({ shared }) => shared.length === 1)).toBe(true);
        expect(list.entries).toHaveLength(252);
        for (const trait of list.entries.map((entry) => entry.trait)) {
          expect(
            actorsOf(trait, 'attack').some((actor) => actor === undefined || actor === 'self' || actor === 'any'),
            trait.name,
          ).toBe(true);
        }
        expect(onlyOthers.length).toBeGreaterThan(50);
        expect(namesOf(list).filter((name) => onlyOthers.some((trait) => trait.name === name))).toEqual([]);
      });

      it('lists for Culmination, which waits for the manual cast of an ally, the 17 traits that wait for one with a fitting actor', () => {
        const list = sameTriggerOf(traitNamed('Culmination'));
        const excluded = traits.filter(
          (trait) =>
            trait.name !== 'Culmination' &&
            actorsOf(trait, 'manual cast').length > 0 &&
            !list.entries.some((entry) => entry.trait.id === trait.id),
        );

        expect(list.triggers).toEqual(['manual cast']);
        expect(namesOf(list)).toEqual([
          'Apprenticeship',
          'Arcane Echo',
          'Charging Rod',
          'Ditto',
          'Escalation',
          'Feed The Fire',
          'I Am Above',
          'Lune',
          'Pandora',
          'Protect the Glass Cannon',
          'Pyromaniac',
          'Shared Consciousness',
          'Slosh',
          'Spectrum of Eternity',
          'Stay Inspired',
          'Twist of Fate',
          'Worship',
        ]);
        // A trait that casts a spell is no trait that waits for a manual one (GAME_RULES R12): all 17 wait for it themselves.
        for (const { trait } of list.entries) expect(actorsOf(trait, 'manual cast'), trait.name).not.toEqual([]);
        expect(excluded).toHaveLength(11);
        for (const trait of excluded) {
          expect(
            actorsOf(trait, 'manual cast').every((actor) => actor === 'self' || actor === 'enemy'),
            trait.name,
          ).toBe(true);
        }
      });

      it('lists for a trait that waits for the start of battle, a moment with no actor, every other trait that waits for it', () => {
        const focus = traitNamed('Extra Padding');
        const everyone = traits.filter(
          ({ id, keywords }) =>
            id !== focus.id && keywords.some((hit) => hit.key === 'start of battle' && hit.role === 'uses'),
        );
        const list = sameTriggerOf(focus);

        expect(list.triggers).toEqual(['start of battle']);
        expect(everyone).toHaveLength(208);
        expect(list.entries.map(({ trait }) => trait.id).toSorted()).toEqual(everyone.map(({ id }) => id).toSorted());
        // Extra Padding has no material, and is read all the same.
        expect(hasMaterial(focus)).toBe(false);
        expect(sameTriggerOf(focus, { artifactOnly: true }).entries.map(({ trait }) => trait.id)).toEqual(
          list.entries.filter(({ trait }) => hasMaterial(trait)).map(({ trait }) => trait.id),
        );
      });

      it('lists, for every trait, exactly the other traits that wait for one of its events with a fitting actor, with the events shared', () => {
        for (const focus of traits) {
          const list = sameTriggerOf(focus);
          const expected = traits
            .filter(({ id }) => id !== focus.id)
            .map((other) => [other.id, sharedBy(focus, other)] as const)
            .filter(([, shared]) => shared.length > 0)
            .toSorted(([a], [b]) => (a < b ? -1 : 1));

          expect(list.triggers, focus.name).toEqual([...waitsOf(focus).keys()]);
          expect(
            list.entries
              .map(({ trait, shared }) => [trait.id, shared] as const)
              .toSorted(([a], [b]) => (a < b ? -1 : 1)),
            focus.name,
          ).toEqual(expected);
        }
      });

      it('ranks by the number of events shared, then by name regardless of case', () => {
        for (const focus of traits) {
          const { entries } = sameTriggerOf(focus);
          for (const [at, entry] of entries.entries()) {
            const before = entries[at - 1];
            if (before === undefined) continue;

            expect(
              before.shared.length > entry.shared.length ||
                (before.shared.length === entry.shared.length && inCase(before.trait.name) <= inCase(entry.trait.name)),
              focus.name,
            ).toBe(true);
          }
        }
      });
    });

    describe('same family', () => {
      const KIND_ORDER = ['mastery', 'creature', 'avatar', 'backer', 'other'];

      it('lists the mastery of the family first, then its creatures by name', () => {
        const list = sameFamilyOf(traitNamed('Sin and Sentence'));

        expect(list.family).toBe('Abomination');
        expect(list.entries.map(({ name }) => name)).toEqual([
          'Master of Abominations',
          'Extra Padding',
          'Flesh Rot',
          'Frailty',
          'Manipulate Fear',
          'Quell',
          'Turn to Gray',
          'Wretchedness',
        ]);
      });

      it('lists for the mastery its creatures, and for a family with creatures and other traits the kinds in order', () => {
        const mastery = sameFamilyOf(traitNamed('Master of Abominations'));
        const apocalypse = sameFamilyOf(traitNamed('Culmination'));

        expect(mastery.entries).toHaveLength(8);
        expect(mastery.entries.map(({ kind }) => kind)).toEqual(Array<string>(8).fill('creature'));
        expect(apocalypse.family).toBe('Apocalypse');
        expect(apocalypse.entries.map(({ name, kind }) => `${kind}: ${name}`)).toEqual([
          'mastery: Master of Apocalypses',
          'creature: Mungus Harbinger',
          'creature: Naxor Harbinger',
          'creature: Phase Out',
          'creature: Quahn Harbinger',
          'creature: Urdox Harbinger',
          'creature: Urh Harbinger',
          'other: Gift of Charybdis',
          'other: Torn Between Scylla and Charybdis',
        ]);
      });

      it('lists, for every trait, exactly the other traits of its family', () => {
        for (const focus of traits) {
          const list = sameFamilyOf(focus);

          expect(list.family, focus.name).toBe(focus.family);
          expect(list.entries.map(({ id }) => id).toSorted(), focus.name).toEqual(
            traits
              .filter(({ id, family }) => id !== focus.id && family === focus.family)
              .map(({ id }) => id)
              .toSorted(),
          );
        }
      });

      it('ranks by kind, then by name regardless of case, so the mastery of a family is always first', () => {
        for (const focus of traits) {
          const { entries } = sameFamilyOf(focus);
          for (const [at, entry] of entries.entries()) {
            const before = entries[at - 1];
            if (before === undefined) continue;
            const kinds = [KIND_ORDER.indexOf(before.kind), KIND_ORDER.indexOf(entry.kind)] as const;

            expect(
              kinds[0] < kinds[1] || (kinds[0] === kinds[1] && inCase(before.name) <= inCase(entry.name)),
              focus.name,
            ).toBe(true);
          }
        }
      });

      it('has nobody but names the family for the six traits that are alone in theirs', () => {
        const alone = traits.filter((trait) => sameFamilyOf(trait).entries.length === 0).map(({ name }) => name);

        expect(alone.toSorted()).toEqual([
          'Brilliant Creation',
          'Gentle Giant',
          'Memoriae',
          'Monster Crown',
          'No Sanctuary',
          'Photomorphogenesis',
        ]);
      });
    });

    describe('all three', () => {
      it('are as long at most as the pages will show, once capped: the biggest lists are 67, 548 and 147', () => {
        const biggest = (length: (trait: Trait) => number) => Math.max(...traits.map(length));

        expect(biggest((trait) => alternativesOf(trait).length)).toBe(67);
        expect(biggest((trait) => sameTriggerOf(trait).entries.length)).toBe(548);
        expect(biggest((trait) => sameFamilyOf(trait).entries.length)).toBe(147);
      });

      it('list the traits with material of the whole lists, in the same order, when the artifact filter is on', () => {
        for (const focus of traits) {
          expect(alternativesOf(focus, { artifactOnly: true }), focus.name).toEqual(
            alternativesOf(focus).filter(({ trait }) => hasMaterial(trait)),
          );
          expect(sameTriggerOf(focus, { artifactOnly: true }), focus.name).toEqual({
            triggers: sameTriggerOf(focus).triggers,
            entries: sameTriggerOf(focus).entries.filter(({ trait }) => hasMaterial(trait)),
          });
          expect(sameFamilyOf(focus, { artifactOnly: true }).entries, focus.name).toEqual(
            sameFamilyOf(focus).entries.filter(hasMaterial),
          );
        }
      });

      it('give the same lists whatever the order of the dataset', () => {
        const reversed = createRelationIndex(traits.toReversed(), taxonomy);
        const ids = (list: readonly { readonly trait: Trait }[]) => list.map(({ trait }) => trait.id);

        for (const focus of traits) {
          for (const options of OPTIONS) {
            const other = {
              alternatives: alternativesOf(focus, options, reversed),
              trigger: sameTriggerOf(focus, options, reversed),
              family: sameFamilyOf(focus, options, reversed),
            };

            expect(ids(other.alternatives), focus.name).toEqual(ids(alternativesOf(focus, options)));
            expect(other.trigger, focus.name).toEqual(sameTriggerOf(focus, options));
            expect(other.family, focus.name).toEqual(sameFamilyOf(focus, options));
          }
        }
      });
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
