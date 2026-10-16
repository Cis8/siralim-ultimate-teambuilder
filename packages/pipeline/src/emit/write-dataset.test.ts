import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Trait } from '@atlas/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emitDataset } from './emit-dataset';
import { writeDataset } from './write-dataset';

const trait = (id: string): Trait => ({
  id,
  name: id,
  creature: 'Somebody',
  family: 'Family',
  class: 'Death',
  kind: 'creature',
  description: 'Text.',
  material: null,
  stacks: true,
  randomDebuff: null,
  masteryFamily: null,
  partyRequirement: null,
  conditionalSources: [],
  keywords: [],
});

const emit = (ids: string[], at: string) =>
  emitDataset({ datasetVersion: '2.0', traits: ids.map(trait) }, new Date(at));

describe('writeDataset', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'atlas-dataset-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('writes the dataset file and the manifest', async () => {
    const emitted = emit(['a--one'], '2026-10-16T10:00:00.000Z');
    const result = await writeDataset(directory, emitted);

    expect(result).toEqual({ changed: true });
    expect(await readFile(join(directory, emitted.datasetFileName), 'utf8')).toBe(emitted.datasetJson);
    expect(await readFile(join(directory, 'manifest.json'), 'utf8')).toBe(emitted.manifestJson);
  });

  it('creates the directory when it does not exist', async () => {
    const nested = join(directory, 'static', 'data');
    await writeDataset(nested, emit(['a--one'], '2026-10-16T10:00:00.000Z'));
    expect(await readdir(nested)).toHaveLength(2);
  });

  it('replaces the previous dataset file and leaves other files alone', async () => {
    const first = emit(['a--one'], '2026-10-16T10:00:00.000Z');
    const second = emit(['a--one', 'b--two'], '2026-10-17T10:00:00.000Z');
    await writeDataset(directory, first);
    await writeFile(join(directory, 'README.txt'), 'keep me');

    const result = await writeDataset(directory, second);

    expect(result).toEqual({ changed: true });
    expect((await readdir(directory)).toSorted()).toEqual(['README.txt', 'manifest.json', second.datasetFileName]);
    expect(await readFile(join(directory, 'manifest.json'), 'utf8')).toBe(second.manifestJson);
  });

  it('touches nothing when the dataset has not changed, not even the generation time', async () => {
    const first = emit(['a--one'], '2026-10-16T10:00:00.000Z');
    const sameDataLater = emit(['a--one'], '2026-10-17T10:00:00.000Z');
    await writeDataset(directory, first);

    const result = await writeDataset(directory, sameDataLater);

    expect(result).toEqual({ changed: false });
    expect(await readFile(join(directory, 'manifest.json'), 'utf8')).toBe(first.manifestJson);
  });

  it('writes again when the manifest is there but the dataset file is gone', async () => {
    const emitted = emit(['a--one'], '2026-10-16T10:00:00.000Z');
    await writeDataset(directory, emitted);
    await rm(join(directory, emitted.datasetFileName));

    expect(await writeDataset(directory, emitted)).toEqual({ changed: true });
    expect(existsSync(join(directory, emitted.datasetFileName))).toBe(true);
  });

  it.each([
    ['unreadable JSON', '{not json'],
    ['a manifest without a hash', '{"datasetVersion":"2.0"}'],
  ])('writes again over %s', async (_label, manifest) => {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'manifest.json'), manifest);
    const emitted = emit(['a--one'], '2026-10-16T10:00:00.000Z');

    expect(await writeDataset(directory, emitted)).toEqual({ changed: true });
    expect(await readFile(join(directory, 'manifest.json'), 'utf8')).toBe(emitted.manifestJson);
  });
});
