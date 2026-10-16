import type { TraitRow } from '@atlas/core';
import { z } from 'zod';
import { COLUMN_HEADERS, type RawTraitRow } from '../sheet/parse-traits-csv';
import { SheetFormatError } from '../sheet/sheet-format-error';
import { normaliseText } from './normalise-text';

const NO_MATERIAL = 'no material exists';

/** A cleaned cell that must say something. */
const required = (column: string) =>
  z
    .string()
    .transform(normaliseText)
    .pipe(z.string().min(1, `${column} is empty`));

const traitRowSchema = z.object({
  class: required(COLUMN_HEADERS.class),
  family: required(COLUMN_HEADERS.family),
  // `Mastery Trait` and `Backer Trait` are kept as written: the next stage derives `kind` from them.
  creature: required(COLUMN_HEADERS.creature),
  name: required(COLUMN_HEADERS.name),
  description: required(COLUMN_HEADERS.description),
  material: required(COLUMN_HEADERS.material).transform((material) =>
    material.toLowerCase() === NO_MATERIAL ? null : material,
  ),
});

const MAX_REPORTED_PROBLEMS = 20;

/**
 * Cleans the cells of every row (see `normaliseText`), turns "No Material Exists" into `null` and checks that nothing
 * a trait needs is empty. An empty Material Name is an error, not "no material": the sheet has an explicit marker.
 *
 * @throws SheetFormatError listing every problem found, so one run shows them all.
 */
export function normaliseRows(rows: readonly RawTraitRow[]): TraitRow[] {
  const result = z.array(traitRowSchema).safeParse(rows);
  if (result.success) return result.data;

  const problems = result.error.issues.map((issue) => {
    const [index] = issue.path;
    if (typeof index !== 'number') return issue.message;
    return `trait row ${index + 1} (${describeRow(rows[index])}): ${issue.message}`;
  });
  const shown = problems.slice(0, MAX_REPORTED_PROBLEMS);
  if (problems.length > shown.length) shown.push(`…and ${problems.length - shown.length} more`);
  throw new SheetFormatError(`The sheet has ${problems.length} problem(s):\n- ${shown.join('\n- ')}`);
}

function describeRow(row: RawTraitRow | undefined): string {
  const label = [row?.family, row?.name]
    .map((cell) => normaliseText(cell ?? ''))
    .filter((cell) => cell !== '')
    .join(' / ');
  return label === '' ? 'no family or name' : label;
}
