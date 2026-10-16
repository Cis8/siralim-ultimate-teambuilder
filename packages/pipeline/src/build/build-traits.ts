import { enrichTraits, type Trait } from '@atlas/core';
import { identifyRows } from '../normalise/identify-rows';
import { normaliseRows } from '../normalise/normalise-rows';
import { parseTraitsCsv } from '../sheet/parse-traits-csv';

export interface BuiltTraits {
  readonly datasetVersion: string;
  readonly traits: readonly Trait[];
}

/**
 * The whole path from the sheet's CSV to traits: parse, clean and validate, give ids, enrich.
 *
 * @throws SheetFormatError if the sheet cannot be trusted; nothing should be published from it.
 */
export function buildTraits(csv: string): BuiltTraits {
  const { datasetVersion, rows } = parseTraitsCsv(csv);
  return { datasetVersion, traits: enrichTraits(identifyRows(normaliseRows(rows))) };
}
