import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchSheet, type FetchSheetOptions } from '../fetch/fetch-sheet';
import { TRAITS_SOURCE, type SheetSource } from '../fetch/sheet-source';

export interface FetchRunOptions {
  readonly cacheDirectory: string;
  readonly source?: SheetSource;
  readonly fetchOptions?: FetchSheetOptions;
  readonly log: (line: string) => void;
}

/** Downloads a tab and keeps it in the cache as `<name>.csv`. A failed download leaves the cache as it was. */
export async function runFetch(options: FetchRunOptions): Promise<{ file: string }> {
  const source = options.source ?? TRAITS_SOURCE;
  const csv = await fetchSheet(source, options.fetchOptions);

  await mkdir(options.cacheDirectory, { recursive: true });
  const file = join(options.cacheDirectory, `${source.name}.csv`);
  await writeFile(file, csv, 'utf8');
  options.log(`Saved the "${source.name}" tab (${csv.length} characters) to ${file}`);
  return { file };
}
