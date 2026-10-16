import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildTraits, type BuiltTraits } from '../build/build-traits';
import { loadOverrides } from '../overrides/load-overrides';

/** The pinned snapshot of the compendium, v2.0. */
export const SNAPSHOT_FILE = new URL('../../fixtures/traits-v2.0.csv', import.meta.url);
/** The corrections as committed. */
export const OVERRIDES_FILE = fileURLToPath(new URL('../../overrides.yaml', import.meta.url));

/** What the pipeline builds from the pinned snapshot with the committed overrides: the real thing, as in production. */
export async function buildRealSheet(): Promise<BuiltTraits> {
  return buildTraits(readFileSync(SNAPSHOT_FILE, 'utf8'), await loadOverrides(OVERRIDES_FILE));
}
