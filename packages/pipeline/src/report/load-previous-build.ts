import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DATASET_SCHEMA_VERSION, datasetFileName } from '@atlas/core';
import { z } from 'zod';
import { readManifestHash } from '../emit/read-manifest-hash';
import type { PreviousBuild } from './build-report';

const emittedDataset = z.object({
  schemaVersion: z.literal(DATASET_SCHEMA_VERSION),
  datasetVersion: z.string(),
  traits: z.array(z.looseObject({ id: z.string() })),
});

/**
 * The dataset a previous run left in `directory`, for the report to compare with. `null` if there is none, or if it
 * is not one this code can read (another schema version, damaged): then there is nothing to compare with.
 */
export async function loadPreviousBuild(directory: string): Promise<PreviousBuild | null> {
  const hash = await readManifestHash(directory);
  if (hash === null) return null;
  const path = join(directory, datasetFileName(hash));
  if (!existsSync(path)) return null;

  try {
    const dataset = emittedDataset.safeParse(JSON.parse(await readFile(path, 'utf8')));
    return dataset.success ? { datasetVersion: dataset.data.datasetVersion, traits: dataset.data.traits } : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
