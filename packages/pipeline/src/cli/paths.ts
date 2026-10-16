import { fileURLToPath } from 'node:url';

const packageRoot = new URL('../../', import.meta.url);
const inPackage = (relativePath: string) => fileURLToPath(new URL(relativePath, packageRoot));

/** Downloaded sheets and the report; not committed (`.cache/` is ignored). */
export const CACHE_DIRECTORY = inPackage('.cache/');

/** Where the web app serves its data from. */
export const DEFAULT_OUTPUT_DIRECTORY = inPackage('../../apps/web/static/data/');
