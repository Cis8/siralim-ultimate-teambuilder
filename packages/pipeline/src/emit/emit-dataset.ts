import { createHash } from 'node:crypto';
import { compareText, DATASET_SCHEMA_VERSION, datasetFileName, type DatasetManifest, type Trait } from '@atlas/core';
import type { BuiltTraits } from '../build/build-traits';

const HASH_LENGTH = 16;

export interface EmittedDataset {
  /** `traits.<hash>.json` */
  readonly datasetFileName: string;
  readonly datasetJson: string;
  readonly manifest: DatasetManifest;
  readonly manifestJson: string;
}

/**
 * Serialises the traits into the dataset file and its manifest. Pure: the clock is a parameter, and the hash covers
 * the dataset's content only, so the same sheet always gives the same file name and bytes.
 *
 * Traits are written sorted by id, so reordering the sheet changes nothing. Each is on its own line, so that a
 * data-refresh pull request shows exactly the traits that changed.
 */
export function emitDataset(built: Pick<BuiltTraits, 'datasetVersion' | 'traits'>, generatedAt: Date): EmittedDataset {
  const traits = built.traits.toSorted((a, b) => compareText(a.id, b.id));
  const datasetJson = serialise(built.datasetVersion, traits);
  const hash = createHash('sha256').update(datasetJson, 'utf8').digest('hex').slice(0, HASH_LENGTH);
  const manifest: DatasetManifest = {
    datasetVersion: built.datasetVersion,
    hash,
    count: traits.length,
    generatedAt: generatedAt.toISOString(),
  };
  return {
    datasetFileName: datasetFileName(hash),
    datasetJson,
    manifest,
    manifestJson: `${JSON.stringify(manifest, null, 2)}\n`,
  };
}

function serialise(datasetVersion: string, traits: readonly Trait[]): string {
  const start = `{"schemaVersion":${DATASET_SCHEMA_VERSION},"datasetVersion":${JSON.stringify(datasetVersion)},"traits":[`;
  if (traits.length === 0) return `${start}]}\n`;
  return `${start}\n${traits.map((trait) => JSON.stringify(trait)).join(',\n')}\n]}\n`;
}
