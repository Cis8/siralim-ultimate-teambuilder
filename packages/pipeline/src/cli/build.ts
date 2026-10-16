import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CACHE_DIRECTORY, DEFAULT_OUTPUT_DIRECTORY, fromWhereTheCommandWasRun } from './paths';
import { runBuild } from './run-build';
import { runCli } from './run-cli';

// `pnpm pipeline:build [--input <csv>] [--output <dir>] [--report <file>]`: cached sheet → dataset + report.
const { values } = parseArgs({
  options: {
    input: { type: 'string', default: join(CACHE_DIRECTORY, 'traits.csv') },
    output: { type: 'string', default: DEFAULT_OUTPUT_DIRECTORY },
    report: { type: 'string', default: join(CACHE_DIRECTORY, 'report.md') },
  },
});

await runCli(() =>
  runBuild({
    inputFile: fromWhereTheCommandWasRun(values.input),
    outputDirectory: fromWhereTheCommandWasRun(values.output),
    reportFile: fromWhereTheCommandWasRun(values.report),
    now: () => new Date(),
    log: console.log,
  }),
);
