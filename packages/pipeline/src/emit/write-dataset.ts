import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MANIFEST_FILE_NAME } from '@atlas/core';
import { z } from 'zod';
import type { EmittedDataset } from './emit-dataset';

const DATASET_FILE = /^traits\.[0-9a-f]+\.json$/;
const manifestWithHash = z.object({ hash: z.string() });

/**
 * Puts the dataset file and the manifest in `directory`, and removes the older dataset files.
 *
 * Nothing is written when the directory already holds this exact dataset: the manifest keeps the time of the build
 * that produced it, so a nightly run over an unchanged sheet leaves the working tree clean and opens no pull request.
 * The dataset file goes first, so the manifest never points to a file that is not there.
 */
export async function writeDataset(directory: string, emitted: EmittedDataset): Promise<{ changed: boolean }> {
  if (
    (await readManifestHash(directory)) === emitted.manifest.hash &&
    existsSync(join(directory, emitted.datasetFileName))
  ) {
    return { changed: false };
  }

  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, emitted.datasetFileName), emitted.datasetJson, 'utf8');
  await writeFile(join(directory, MANIFEST_FILE_NAME), emitted.manifestJson, 'utf8');
  for (const name of await readdir(directory)) {
    if (DATASET_FILE.test(name) && name !== emitted.datasetFileName) await rm(join(directory, name));
  }
  return { changed: true };
}

/** The hash in the manifest on disk, or `null` if there is none or it cannot be read. */
async function readManifestHash(directory: string): Promise<string | null> {
  const path = join(directory, MANIFEST_FILE_NAME);
  if (!existsSync(path)) return null;
  try {
    const manifest = manifestWithHash.safeParse(JSON.parse(await readFile(path, 'utf8')));
    return manifest.success ? manifest.data.hash : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
