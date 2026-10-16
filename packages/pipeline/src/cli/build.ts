import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CACHE_DIRECTORY, DEFAULT_OUTPUT_DIRECTORY, fromWhereTheCommandWasRun, OVERRIDES_FILE } from './paths';
import { runBuild } from './run-build';
import { runCli } from './run-cli';

// `pnpm pipeline:build [--input <csv>] [--overrides <yaml>] [--output <dir>] [--report <file>]`: cached sheet → dataset + report.
const { values } = parseArgs({
  options: {
    input: { type: 'string', default: join(CACHE_DIRECTORY, 'traits.csv') },
    overrides: { type: 'string', default: OVERRIDES_FILE },
    output: { type: 'string', default: DEFAULT_OUTPUT_DIRECTORY },
    report: { type: 'string', default: join(CACHE_DIRECTORY, 'report.md') },
  },
});

await runCli(() =>
  runBuild({
    inputFile: fromWhereTheCommandWasRun(values.input),
    overridesFile: fromWhereTheCommandWasRun(values.overrides),
    outputDirectory: fromWhereTheCommandWasRun(values.output),
    reportFile: fromWhereTheCommandWasRun(values.report),
    now: () => new Date(),
    log: console.log,
  }),
);
