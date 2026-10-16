import { enrichTraits, type Trait } from '@atlas/core';
import { identifyRows } from '../normalise/identify-rows';
import { normaliseRows } from '../normalise/normalise-rows';
import { applyOverrides } from '../overrides/apply-overrides';
import type { Overrides } from '../overrides/parse-overrides';
import { parseTraitsCsv } from '../sheet/parse-traits-csv';

export interface BuiltTraits {
  readonly datasetVersion: string;
  readonly traits: readonly Trait[];
  /** Overrides that changed nothing: worth a look, not a failure. */
  readonly warnings: readonly string[];
}

const NO_OVERRIDES: Overrides = { roles: [], randomDebuff: [] };

/**
 * The whole path from the sheet's CSV to traits: parse, clean and validate, give ids, enrich (kind, keywords, …),
 * then put the hand-made corrections over the result.
 *
 * @throws SheetFormatError if the sheet cannot be trusted; OverridesError if a correction does not fit it. Nothing
 * should be published from either.
 */
export function buildTraits(csv: string, overrides: Overrides = NO_OVERRIDES): BuiltTraits {
  const { datasetVersion, rows } = parseTraitsCsv(csv);
  const enriched = enrichTraits(identifyRows(normaliseRows(rows)));
  const { traits, warnings } = applyOverrides(enriched, overrides);
  return { datasetVersion, traits, warnings };
}
