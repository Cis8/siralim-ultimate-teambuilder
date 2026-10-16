import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { OverridesError } from './overrides-error';
import { parseOverrides, type Overrides } from './parse-overrides';

/**
 * Reads the overrides file. A file that is missing is an error, not "no overrides": a build that silently went without
 * its corrections would publish the extractor's mistakes.
 *
 * @throws OverridesError
 */
export async function loadOverrides(file: string): Promise<Overrides> {
  if (!existsSync(file)) throw new OverridesError(`There is no overrides file at ${file}`);
  return parseOverrides(await readFile(file, 'utf8'));
}
