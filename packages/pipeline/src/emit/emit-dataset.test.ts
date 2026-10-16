import { createHash } from 'node:crypto';
import { DATASET_SCHEMA_VERSION, type Trait, type TraitDataset } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { emitDataset } from './emit-dataset';

function trait(overrides: Partial<Trait> = {}): Trait {
  return {
    id: 'abomination--flesh-rot',
    name: 'Flesh Rot',
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Afflicts a debuff. It\'s "bad".',
    material: 'Brute Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    ...overrides,
  };
}

const TRAITS = [trait({ id: 'b--second' }), trait({ id: 'a--first' }), trait({ id: 'c--third' })];
const BUILT = { datasetVersion: '2.0', traits: TRAITS };
const NOW = new Date('2026-10-16T12:30:00.000Z');

describe('emitDataset', () => {
  it('gives the same bytes and hash for the same input', () => {
    const first = emitDataset(BUILT, NOW);
    const second = emitDataset({ datasetVersion: '2.0', traits: TRAITS.map((t) => ({ ...t })) }, NOW);
    expect(second.datasetJson).toBe(first.datasetJson);
    expect(second.manifest.hash).toBe(first.manifest.hash);
  });

  it('does not depend on the order of the traits', () => {
    const reordered = emitDataset({ datasetVersion: '2.0', traits: TRAITS.toReversed() }, NOW);
    expect(reordered.datasetJson).toBe(emitDataset(BUILT, NOW).datasetJson);
  });

  it('does not depend on the time: the hash is of the content only', () => {
    const later = emitDataset(BUILT, new Date('2027-01-01T00:00:00.000Z'));
    expect(later.datasetJson).toBe(emitDataset(BUILT, NOW).datasetJson);
    expect(later.manifest.hash).toBe(emitDataset(BUILT, NOW).manifest.hash);
  });

  it('changes the hash when a trait changes', () => {
    const edited = emitDataset(
      { datasetVersion: '2.0', traits: [...TRAITS.slice(1), trait({ id: 'b--second', name: 'X' })] },
      NOW,
    );
    expect(edited.manifest.hash).not.toBe(emitDataset(BUILT, NOW).manifest.hash);
  });

  it('changes the hash when only the dataset version changes', () => {
    expect(emitDataset({ ...BUILT, datasetVersion: '2.1' }, NOW).manifest.hash).not.toBe(
      emitDataset(BUILT, NOW).manifest.hash,
    );
  });

  describe('the dataset file', () => {
    const emitted = emitDataset(BUILT, NOW);

    it('reads back as the schema version, the dataset version and the traits sorted by id', () => {
      const dataset = JSON.parse(emitted.datasetJson) as TraitDataset;
      expect(dataset.schemaVersion).toBe(DATASET_SCHEMA_VERSION);
      expect(dataset.datasetVersion).toBe('2.0');
      expect(dataset.traits.map((t) => t.id)).toEqual(['a--first', 'b--second', 'c--third']);
      expect(dataset.traits[0]).toEqual(TRAITS[1]);
    });

    it('puts one trait on each line, so that a changed trait is a one-line diff', () => {
      const lines = emitted.datasetJson.split('\n');
      expect(lines.filter((line) => line.startsWith('{"id":'))).toHaveLength(3);
      expect(lines).toHaveLength(6);
    });

    it('ends with a newline', () => {
      expect(emitted.datasetJson.endsWith('\n')).toBe(true);
    });

    it('is named after the hash', () => {
      expect(emitted.datasetFileName).toBe(`traits.${emitted.manifest.hash}.json`);
    });

    it('is hashed with SHA-256, keeping 16 hexadecimal digits', () => {
      const expected = createHash('sha256').update(emitted.datasetJson, 'utf8').digest('hex').slice(0, 16);
      expect(emitted.manifest.hash).toBe(expected);
      expect(emitted.manifest.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('keeps quotes and non-ASCII text intact', () => {
      const text = emitDataset({ datasetVersion: '2.0', traits: [trait({ description: 'Café "x" \\  ' })] }, NOW);
      const dataset = JSON.parse(text.datasetJson) as TraitDataset;
      expect(dataset.traits[0]?.description).toBe('Café "x" \\  ');
    });
  });

  describe('the manifest', () => {
    const emitted = emitDataset(BUILT, NOW);

    it('says which dataset to load and how big it is', () => {
      expect(emitted.manifest).toEqual({
        datasetVersion: '2.0',
        hash: emitted.manifest.hash,
        count: 3,
        generatedAt: '2026-10-16T12:30:00.000Z',
      });
    });

    it('is readable JSON ending with a newline', () => {
      expect(JSON.parse(emitted.manifestJson)).toEqual(emitted.manifest);
      expect(emitted.manifestJson).toBe(`${JSON.stringify(emitted.manifest, null, 2)}\n`);
    });
  });

  it('emits an empty dataset', () => {
    const emitted = emitDataset({ datasetVersion: '2.0', traits: [] }, NOW);
    expect(emitted.manifest.count).toBe(0);
    expect((JSON.parse(emitted.datasetJson) as TraitDataset).traits).toEqual([]);
  });
});
