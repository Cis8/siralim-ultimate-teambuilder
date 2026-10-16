import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { DatasetManifest } from '@atlas/core';
import { buildTraits } from '../build/build-traits';
import { emitDataset } from '../emit/emit-dataset';
import { writeDataset } from '../emit/write-dataset';
import { loadOverrides } from '../overrides/load-overrides';
import { buildReport } from '../report/build-report';
import { loadPreviousBuild } from '../report/load-previous-build';
import { CliError } from './cli-error';

export interface BuildRunOptions {
  /** The cached CSV. */
  readonly inputFile: string;
  /** The hand-made corrections (`overrides.yaml`). */
  readonly overridesFile: string;
  /** Where `manifest.json` and `traits.<hash>.json` go; what is already there is the previous build. */
  readonly outputDirectory: string;
  readonly reportFile: string;
  readonly now: () => Date;
  readonly log: (line: string) => void;
}

/**
 * Builds the dataset from a downloaded sheet: validate, enrich, compare with the previous build, write the dataset
 * and the report. Nothing is written if the sheet is not valid.
 */
export async function runBuild(options: BuildRunOptions): Promise<{ changed: boolean; manifest: DatasetManifest }> {
  if (!existsSync(options.inputFile)) {
    throw new CliError(`There is no sheet at ${options.inputFile}: run \`pnpm pipeline:fetch\` first`);
  }

  const overrides = await loadOverrides(options.overridesFile);
  const built = buildTraits(await readFile(options.inputFile, 'utf8'), overrides);
  const previous = await loadPreviousBuild(options.outputDirectory);
  const report = buildReport(built, previous);
  const emitted = emitDataset(built, options.now());

  const { changed } = await writeDataset(options.outputDirectory, emitted);
  await mkdir(dirname(options.reportFile), { recursive: true });
  await writeFile(options.reportFile, report, 'utf8');

  const { datasetVersion, count, hash } = emitted.manifest;
  options.log(`Dataset v${datasetVersion}: ${count} traits, hash ${hash} (${changed ? 'changed' : 'unchanged'})`);
  for (const warning of built.warnings) options.log(`Warning, override ${warning}`);
  options.log(`Report: ${options.reportFile}`);
  return { changed, manifest: emitted.manifest };
}
