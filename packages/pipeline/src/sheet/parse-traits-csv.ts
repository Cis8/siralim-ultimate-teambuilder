import { parse } from 'csv-parse/sync';
import { SheetFormatError } from './sheet-format-error';

const FIELDS = ['class', 'family', 'creature', 'name', 'description', 'material'] as const;
type Field = (typeof FIELDS)[number];

/** The sheet's column names, as written in its header row. */
const HEADERS: Readonly<Record<Field, string>> = {
  class: 'Class',
  family: 'Family',
  creature: 'Creature',
  name: 'Trait Name',
  description: 'Trait Description',
  material: 'Material Name',
};

type ColumnIndex = Readonly<Record<Field, number>>;

/** One row of the Traits tab. Cell text is exactly as published: cleaning it is the next pipeline stage. */
export type RawTraitRow = Readonly<Record<Field, string>>;

export interface ParsedSheet {
  /** From the preamble: `2.0` for "Version 2.0". */
  readonly datasetVersion: string;
  readonly rows: readonly RawTraitRow[];
}

/**
 * Reads the CSV export of the Traits tab (SPEC §2): a free-form preamble that carries the version, then a header row,
 * then one row per trait. The header is found by its column names, so extra, missing-from-the-front or reordered
 * columns do not matter; a missing required column does.
 *
 * @throws SheetFormatError when the CSV is malformed, has no complete header, or states no version.
 */
export function parseTraitsCsv(csv: string): ParsedSheet {
  const records = readRecords(csv);
  const header = findHeader(records);
  return {
    datasetVersion: findVersion(records.slice(0, header.index)),
    rows: records
      .slice(header.index + 1)
      .filter((record) => !isBlank(record))
      .map((record) => toRow(record, header.columns)),
  };
}

function readRecords(csv: string): string[][] {
  try {
    // Blank lines are kept (as `['']`) so that a record's position is its row number in the sheet.
    return parse(csv, { bom: true, relax_column_count: true });
  } catch (error) {
    throw new SheetFormatError(`Not valid CSV: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function findHeader(records: readonly string[][]): { index: number; columns: ColumnIndex } {
  let closest: { index: number; found: Partial<ColumnIndex>; count: number } = { index: -1, found: {}, count: 0 };
  for (const [index, record] of records.entries()) {
    const found = matchColumns(record);
    if (isComplete(found)) return { index, columns: found };
    const count = FIELDS.filter((field) => found[field] !== undefined).length;
    if (count > closest.count) closest = { index, found, count };
  }

  if (closest.count === 0) {
    const expected = FIELDS.map((field) => HEADERS[field]).join(', ');
    throw new SheetFormatError(`No header row found: expected a row with the columns ${expected}`);
  }
  const missing = FIELDS.filter((field) => closest.found[field] === undefined).map((field) => HEADERS[field]);
  throw new SheetFormatError(`Header row (row ${closest.index + 1}) is missing the column(s): ${missing.join(', ')}`);
}

function matchColumns(record: readonly string[]): Partial<ColumnIndex> {
  const found: Partial<Record<Field, number>> = {};
  for (const [column, cell] of record.entries()) {
    const text = normaliseHeader(cell);
    for (const field of FIELDS) {
      if (found[field] === undefined && normaliseHeader(HEADERS[field]) === text) found[field] = column;
    }
  }
  return found;
}

function isComplete(found: Partial<ColumnIndex>): found is ColumnIndex {
  return FIELDS.every((field) => found[field] !== undefined);
}

function normaliseHeader(cell: string): string {
  return cell.trim().replace(/\s+/g, ' ').toLowerCase();
}

const VERSION = /\bversion\s*:?\s*v?(\d+(?:\.\d+)*)/i;

function findVersion(preamble: readonly string[][]): string {
  for (const record of preamble) {
    for (const cell of record) {
      const version = VERSION.exec(cell)?.[1];
      if (version !== undefined) return version;
    }
  }
  throw new SheetFormatError('No dataset version found above the header: expected a cell like "Version 2.0"');
}

function isBlank(record: readonly string[]): boolean {
  return record.every((cell) => cell.trim() === '');
}

function toRow(record: readonly string[], columns: ColumnIndex): RawTraitRow {
  const cell = (field: Field) => record[columns[field]] ?? '';
  return {
    class: cell('class'),
    family: cell('family'),
    creature: cell('creature'),
    name: cell('name'),
    description: cell('description'),
    material: cell('material'),
  };
}
