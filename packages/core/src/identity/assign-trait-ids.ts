import type { IdentifiedTraitRow, TraitRow } from '../model/trait';
import { slugify } from './slugify';

/**
 * Gives every row a stable id: `<family slug>--<name slug>` (SPEC §5).
 *
 * When several rows share an id, the first by content keeps the plain slug and the others get `-2`, `-3`, … so the
 * result never depends on the order of `rows`. Suffixes skip ids that another row owns naturally (`Foo 2` is
 * `foo-2`). Rows are returned in input order.
 *
 * @throws if the family or the trait name leaves nothing to build an id from.
 */
export function assignTraitIds(rows: readonly TraitRow[]): IdentifiedTraitRow[] {
  const entries = rows.map((row, index) => ({ row, index, base: baseId(row) }));
  const taken = new Set(entries.map((entry) => entry.base));

  const identified: { index: number; row: TraitRow; id: string }[] = [];
  let previousBase: string | null = null;
  let suffix = 1;
  for (const { row, index, base } of entries.toSorted(compareEntries)) {
    if (base !== previousBase) {
      previousBase = base;
      suffix = 1;
      identified.push({ index, row, id: base });
      continue;
    }
    let id: string;
    do {
      suffix += 1;
      id = `${base}-${suffix}`;
    } while (taken.has(id));
    taken.add(id);
    identified.push({ index, row, id });
  }

  return identified.toSorted((a, b) => a.index - b.index).map(({ row, id }) => ({ ...row, id }));
}

function baseId(row: TraitRow): string {
  const family = slugify(row.family);
  if (family === '') throw new Error(`Cannot build an id: family "${row.family}" has no letters or digits`);
  const name = slugify(row.name);
  if (name === '') throw new Error(`Cannot build an id: trait name "${row.name}" has no letters or digits`);
  return `${family}--${name}`;
}

interface Entry {
  readonly row: TraitRow;
  readonly base: string;
}

function compareEntries(a: Entry, b: Entry): number {
  return compareText(a.base, b.base) || compareContent(a.row, b.row);
}

/** Total order on row content, so that colliding rows are ranked the same way whatever order they arrive in. */
function compareContent(a: TraitRow, b: TraitRow): number {
  return (
    compareText(a.family, b.family) ||
    compareText(a.name, b.name) ||
    compareText(a.class, b.class) ||
    compareText(a.creature, b.creature) ||
    compareText(a.description, b.description) ||
    compareMaterial(a.material, b.material)
  );
}

function compareMaterial(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return compareText(a, b);
}

/** UTF-16 code unit order, unlike `localeCompare`, which varies with the runtime's locale. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
