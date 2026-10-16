import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = new URL('../../', import.meta.url);
const inPackage = (relativePath: string) => fileURLToPath(new URL(relativePath, packageRoot));

/** Downloaded sheets and the report; not committed (`.cache/` is ignored). */
export const CACHE_DIRECTORY = inPackage('.cache/');

/** The hand-made corrections to the extractor. */
export const OVERRIDES_FILE = inPackage('overrides.yaml');

/** Where the web app serves its data from. */
export const DEFAULT_OUTPUT_DIRECTORY = inPackage('../../apps/web/static/data/');

/**
 * A path given on the command line. pnpm runs the script inside this package, so a relative path is taken from where the
 * command was typed (`INIT_CWD`, which pnpm sets), as the person typing it expects.
 */
export const fromWhereTheCommandWasRun = (path: string) => resolve(process.env.INIT_CWD ?? process.cwd(), path);
