import { describe, expect, it } from 'vitest';
import { DATASET_SCHEMA_VERSION } from '../model/dataset';
import { createMemoryTraitRepository } from './memory-trait-repository';

describe('createMemoryTraitRepository', () => {
  it('loads the dataset it was given', async () => {
    const dataset = { schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: '2.0', traits: [] };

    await expect(createMemoryTraitRepository(dataset).load()).resolves.toBe(dataset);
  });
});
