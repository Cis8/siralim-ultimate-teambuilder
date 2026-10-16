import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Trait } from '@atlas/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emitDataset } from '../emit/emit-dataset';
import { writeDataset } from '../emit/write-dataset';
import { loadPreviousBuild } from './load-previous-build';

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
  keywords: [],
});

describe('loadPreviousBuild', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'atlas-previous-'));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('reads back the dataset that writeDataset put there', async () => {
    const traits = [trait('a--one'), trait('b--two')];
    await writeDataset(directory, emitDataset({ datasetVersion: '2.0', traits }, new Date('2026-10-16T10:00:00Z')));

    const previous = await loadPreviousBuild(directory);

    expect(previous?.datasetVersion).toBe('2.0');
    expect(previous?.traits).toEqual(traits);
  });

  it('finds nothing in a directory that does not exist or is empty', async () => {
    expect(await loadPreviousBuild(join(directory, 'missing'))).toBeNull();
    expect(await loadPreviousBuild(directory)).toBeNull();
  });

  it('finds nothing when the manifest points to a dataset that is not there', async () => {
    await writeFile(
      join(directory, 'manifest.json'),
      JSON.stringify({
        datasetVersion: '2.0',
        hash: 'abcdef0123456789',
        count: 1,
        generatedAt: '2026-10-16T10:00:00Z',
      }),
    );
    expect(await loadPreviousBuild(directory)).toBeNull();
  });

  it.each([
    ['unreadable JSON', '{not json'],
    ['another schema version', JSON.stringify({ schemaVersion: 999, datasetVersion: '2.0', traits: [] })],
    [
      'traits that are not objects with an id',
      JSON.stringify({ schemaVersion: 1, datasetVersion: '2.0', traits: [1] }),
    ],
  ])('finds nothing in a dataset file with %s', async (_label, contents) => {
    await mkdir(directory, { recursive: true });
    await writeFile(
      join(directory, 'manifest.json'),
      JSON.stringify({
        datasetVersion: '2.0',
        hash: 'abcdef0123456789',
        count: 0,
        generatedAt: '2026-10-16T10:00:00Z',
      }),
    );
    await writeFile(join(directory, 'traits.abcdef0123456789.json'), contents);
    expect(await loadPreviousBuild(directory)).toBeNull();
  });
});
