import { assignTraitIds, traitIdBase, type IdentifiedTraitRow, type TraitRow } from '@atlas/core';
import { SheetFormatError } from '../sheet/sheet-format-error';

/**
 * Gives every row its id, and refuses a sheet in which two rows would share one.
 *
 * `assignTraitIds` could make colliding ids unique, but the extra ones depend on how the colliding rows rank, so
 * editing one description could swap the ids of two traits and silently repoint saved parties. A collision is
 * far more likely a sheet mistake than two real traits, so the build stops and the sheet gets fixed (SPEC §6).
 *
 * @throws SheetFormatError on a collision or a name that cannot form an id.
 */
export function identifyRows(rows: readonly TraitRow[]): IdentifiedTraitRow[] {
  rejectCollisions(rows);
  return assignTraitIds(rows);
}

function rejectCollisions(rows: readonly TraitRow[]): void {
  const rowsById = new Map<string, TraitRow[]>();
  for (const row of rows) {
    const id = idOf(row);
    rowsById.set(id, [...(rowsById.get(id) ?? []), row]);
  }

  const collisions = [...rowsById].filter(([, sharing]) => sharing.length > 1);
  if (collisions.length === 0) return;
  const lines = collisions.map(
    ([id, sharing]) =>
      `"${id}" is shared by ${sharing.map((row) => `${row.family} / ${row.creature} / ${row.name}`).join(' and ')}`,
  );
  throw new SheetFormatError(`Trait ids must be unique, but:\n- ${lines.join('\n- ')}`);
}

function idOf(row: TraitRow): string {
  try {
    return traitIdBase(row);
  } catch (error) {
    throw new SheetFormatError(error instanceof Error ? error.message : String(error), { cause: error });
  }
}
