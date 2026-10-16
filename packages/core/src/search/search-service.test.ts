import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_VERSION } from '../model/dataset';
import type { Trait } from '../model/trait';
import { createMemoryTraitRepository } from '../repository/memory-trait-repository';
import { DatasetLoadError, type TraitRepository } from '../repository/trait-repository';
import { createSearchService } from './search-service';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: 'Brute Stitches',
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const traits = [
  trait('weak-stacks', { description: 'Applies Weak to an enemy.' }),
  trait('weak-no-stack', { description: 'Applies Weak to an enemy. This trait does not stack.', stacks: false }),
  trait('heal', { class: 'Life' }),
];

const service = () =>
  createSearchService(
    createMemoryTraitRepository({ schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits }),
  );

describe('createSearchService', () => {
  it('knows the version and the size of the dataset it loaded', async () => {
    const loaded = await service();

    expect(loaded.datasetVersion).toBe('2.0');
    expect(loaded.traitCount).toBe(3);
  });

  it('finds every trait, in the order of the dataset, for a query with no term', async () => {
    const { traits: found } = (await service()).search('');

    expect(found.map(({ id }) => id)).toEqual(['weak-stacks', 'weak-no-stack', 'heal']);
  });

  it('finds the traits the query asks for', async () => {
    const { traits: found } = (await service()).search('weak -stack:no');

    expect(found.map(({ id }) => id)).toEqual(['weak-stacks']);
  });

  it('reads the query once and reports what it had to repair', async () => {
    const { query, traits: found } = (await service()).search('class:life (');

    expect(query.diagnostics).toHaveLength(1);
    expect(found.map(({ id }) => id)).toEqual(['heal']);
  });

  it('marks, in a description, the text the query looks for', async () => {
    const { highlight } = (await service()).search('weak');

    expect(highlight('Applies Weak to an enemy.')).toEqual([[8, 12]]);
  });

  it('marks nothing for a query with no term', async () => {
    const { highlight } = (await service()).search('');

    expect(highlight('Applies Weak to an enemy.')).toEqual([]);
  });

  it('does not load again for a second search', async () => {
    let loads = 0;
    const repository: TraitRepository = {
      load: () => {
        loads += 1;
        return createMemoryTraitRepository({
          schemaVersion: DATASET_SCHEMA_VERSION,
          datasetVersion: '2.0',
          traits,
        }).load();
      },
    };

    const loaded = await createSearchService(repository);
    loaded.search('weak');
    loaded.search('heal');

    expect(loads).toBe(1);
  });

  it('fails the way the repository failed when the dataset cannot be loaded', async () => {
    const failure = new DatasetLoadError('offline');
    const repository: TraitRepository = { load: () => Promise.reject(failure) };

    await expect(createSearchService(repository)).rejects.toBe(failure);
  });
});
