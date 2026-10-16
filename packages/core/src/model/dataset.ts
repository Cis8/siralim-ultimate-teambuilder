import type { Trait } from './trait';

/** The dataset file the pipeline writes and the web app reads: every trait of one version of the compendium. */
export interface TraitDataset {
  /** `DATASET_SCHEMA_VERSION` at the time the file was written. */
  readonly schemaVersion: number;
  /** The sheet's own version, e.g. `2.0`. */
  readonly datasetVersion: string;
  readonly traits: readonly Trait[];
}

/** What the web app fetches first to learn which dataset file to load. */
export interface DatasetManifest {
  readonly datasetVersion: string;
  /** Hash of the dataset file's content: it is part of the file name. */
  readonly hash: string;
  readonly count: number;
  /** ISO 8601, UTC. */
  readonly generatedAt: string;
}

export const MANIFEST_FILE_NAME = 'manifest.json';

/** The hash is in the name, so a changed dataset is a new URL and can be cached forever. */
export function datasetFileName(hash: string): string {
  return `traits.${hash}.json`;
}
