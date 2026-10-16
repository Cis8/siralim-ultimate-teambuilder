import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MANIFEST_FILE_NAME } from '@atlas/core';
import { z } from 'zod';

// The hash becomes part of a file name, so only hexadecimal digits are accepted.
const manifestWithHash = z.object({ hash: z.string().regex(/^[0-9a-f]+$/) });

/** The dataset hash in the manifest of `directory`, or `null` if there is no manifest or it cannot be read. */
export async function readManifestHash(directory: string): Promise<string | null> {
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
