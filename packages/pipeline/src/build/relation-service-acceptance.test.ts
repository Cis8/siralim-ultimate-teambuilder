import {
  createMemoryTraitRepository,
  createRelationIndex,
  createRelationService,
  DATASET_SCHEMA_VERSION,
  keywordFromSlug,
  keywordSlug,
  taxonomy,
  type RelationIndex,
  type RelationService,
  type Trait,
} from '@atlas/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildRealSheet } from '../testing/real-build';

// What the relation service (Phase 2, M12.5) says on the pinned snapshot of the compendium, v2.0.

describe('the relation service on the compendium v2.0', () => {
  let traits: readonly Trait[];
  let index: RelationIndex;
  let service: RelationService;

  const names = (found: readonly Trait[]) => found.map(({ name }) => name);

  beforeAll(async () => {
    const built = await buildRealSheet();
    traits = built.traits;
    index = createRelationIndex(traits, taxonomy);
    service = await createRelationService(
      createMemoryTraitRepository({
        schemaVersion: DATASET_SCHEMA_VERSION,
        datasetVersion: built.datasetVersion,
        traits,
      }),
    );
  });

  it('holds the dataset: its version, and every trait by id', () => {
    expect(service.datasetVersion).toBe('2.0');
    expect(traits).toHaveLength(1780);
    for (const trait of traits) expect(service.trait(trait.id)).toBe(trait);
  });

  it('answers as the index does for every trait, with and without the artifact filter', () => {
    for (const { id } of traits) {
      for (const options of [{}, { artifactOnly: true }]) {
        expect(service.relationsOf(id, options)).toEqual(index.relationsOf(id, options));
        expect(service.alternativesOf(id, options)).toEqual(index.alternativesOf(id, options));
        expect(service.sameTriggerOf(id, options)).toEqual(index.sameTriggerOf(id, options));
        expect(service.sameFamilyOf(id, options)).toEqual(index.sameFamilyOf(id, options));
      }
    }
  });

  describe('keyword addresses', () => {
    it('has an address for each of the 42 keys that have a page, and each reads back as its key', () => {
      const slugs = service.keys.map(keywordSlug);

      expect(service.keys).toHaveLength(42);
      expect(new Set(slugs).size).toBe(42);
      expect(slugs.map((slug) => keywordFromSlug(slug, service.keys))).toEqual(service.keys);
    });

    it('writes the keys of two words with a hyphen', () => {
      expect(keywordSlug('mega magic')).toBe('mega-magic');
      expect(keywordFromSlug('dire-wolves', service.keys)).toBe('dire wolves');
    });

    it('has no page for an event, a mechanic or a flag: they are not among the keys', () => {
      const withoutPage = taxonomy.entries.filter(({ key }) => !service.keys.includes(key));

      expect(withoutPage.length).toBeGreaterThan(0);
      for (const { key } of withoutPage) expect(keywordFromSlug(keywordSlug(key), service.keys)).toBeUndefined();
    });
  });

  describe('finding a focus', () => {
    it('finds a trait from its whole name, every one of the 1,780', () => {
      for (const trait of traits) {
        expect(service.findTraits(trait.name, 25)).toContain(trait);
      }
    });

    it('puts the trait whose name was typed in full first, unless another name begins with it', () => {
      expect(names(service.findTraits('Jungle Boogie', 3))[0]).toBe('Jungle Boogie');
      expect(names(service.findTraits('sin and sentence', 3))).toEqual(['Sin and Sentence']);
    });

    it('lists the traits whose name begins with the letters first, in the order of the alphabet', () => {
      const found = names(service.findTraits('fl', 12));
      const beginning = found.filter((name) => name.toLowerCase().startsWith('fl'));

      expect(beginning.length).toBeGreaterThan(1);
      expect(found.slice(0, beginning.length)).toEqual(beginning);
      for (const [at, name] of beginning.entries()) {
        const before = beginning[at - 1]?.toLowerCase() ?? '';
        expect(before <= name.toLowerCase()).toBe(true);
      }
    });

    it('finds a family by the letters of its name, and lists no more than it was asked', () => {
      const found = service.findTraits('abomination', 10);

      expect(found).toHaveLength(10);
      for (const trait of found) {
        const texts = [trait.name, trait.creature ?? '', trait.family];
        expect(texts.some((text) => text.toLowerCase().includes('abomination'))).toBe(true);
      }
    });

    it('finds nothing for nothing typed or for a text no trait has', () => {
      expect(service.findTraits('', 10)).toEqual([]);
      expect(service.findTraits('zzzzzz', 10)).toEqual([]);
    });
  });
});
