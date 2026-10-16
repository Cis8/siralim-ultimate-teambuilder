import { CACHE_DIRECTORY } from './paths';
import { runCli } from './run-cli';
import { runFetch } from './run-fetch';

// `pnpm pipeline:fetch`: download the sheet into packages/pipeline/.cache.
await runCli(() => runFetch({ cacheDirectory: CACHE_DIRECTORY, log: console.log }));
