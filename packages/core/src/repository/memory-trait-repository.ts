import type { TraitDataset } from '../model/dataset';
import type { TraitRepository } from './trait-repository';

/** A repository over a dataset already in memory: what tests and fixtures use. */
export function createMemoryTraitRepository(dataset: TraitDataset): TraitRepository {
  return { load: () => Promise.resolve(dataset) };
}
