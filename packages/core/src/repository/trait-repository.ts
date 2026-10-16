import type { TraitDataset } from '../model/dataset';

/**
 * Where the traits come from. The app reads the static JSON the pipeline emitted; tests bring a dataset of their own.
 * Nothing above this interface knows which.
 */
export interface TraitRepository {
  /** Rejects with a `DatasetLoadError` when the dataset cannot be read. */
  load(): Promise<TraitDataset>;
}

/** The dataset could not be read: it is not there, it is not a dataset, or it is of a format this app does not read. */
export class DatasetLoadError extends Error {
  override readonly name = 'DatasetLoadError';
}
