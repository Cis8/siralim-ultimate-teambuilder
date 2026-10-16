import { DATASET_SCHEMA_VERSION, type DatasetManifest, type TraitDataset } from '../model/dataset';
import type { Trait } from '../model/trait';
import { DatasetLoadError } from './trait-repository';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The only characters of a hash, which names the dataset file: nothing in it can reach another file. */
const HASH = /^[0-9a-f]+$/u;

/**
 * Reads the JSON of a dataset file. The format version is what vouches for the traits: the pipeline writes the file
 * with `DATASET_SCHEMA_VERSION`, so a file of the same version has traits of the shape `Trait` describes, and one of
 * another version is refused rather than read wrongly.
 */
export function readDataset(json: unknown): TraitDataset {
  if (!isRecord(json)) throw new DatasetLoadError('The dataset file is not a JSON object.');
  if (json.schemaVersion !== DATASET_SCHEMA_VERSION) {
    throw new DatasetLoadError(
      `The dataset file has format version ${String(json.schemaVersion)}; this app reads format version ${String(DATASET_SCHEMA_VERSION)}.`,
    );
  }
  const { datasetVersion, traits } = json;
  if (typeof datasetVersion !== 'string') throw new DatasetLoadError('The dataset file does not say its version.');
  if (!Array.isArray(traits)) throw new DatasetLoadError('The dataset file has no list of traits.');
  return { schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion, traits: traits as readonly Trait[] };
}

/** Reads the JSON of the manifest, which tells which dataset file is the current one. */
export function readManifest(json: unknown): DatasetManifest {
  if (!isRecord(json)) throw new DatasetLoadError('The manifest is not a JSON object.');
  const { datasetVersion, hash, count, generatedAt } = json;
  if (typeof datasetVersion !== 'string') throw new DatasetLoadError('The manifest does not say the dataset version.');
  if (typeof hash !== 'string' || !HASH.test(hash)) {
    throw new DatasetLoadError('The manifest does not name the dataset file by a hash of hex digits.');
  }
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
    throw new DatasetLoadError('The manifest does not give a count of traits.');
  }
  if (typeof generatedAt !== 'string') throw new DatasetLoadError('The manifest does not say when it was generated.');
  return { datasetVersion, hash, count, generatedAt };
}
