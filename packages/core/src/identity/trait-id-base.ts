import type { TraitRow } from '../model/trait';
import { slugify } from './slugify';

/**
 * The id a trait gets when nothing else shares it: `<family slug>--<name slug>` (SPEC §5). The double hyphen cannot
 * occur inside a slug, so two different (family, name) pairs never join into the same text by accident.
 *
 * @throws if the family or the trait name leaves nothing to build an id from.
 */
export function traitIdBase(row: Pick<TraitRow, 'family' | 'name'>): string {
  const family = slugify(row.family);
  if (family === '') throw new Error(`Cannot build an id: family "${row.family}" has no letters or digits`);
  const name = slugify(row.name);
  if (name === '') throw new Error(`Cannot build an id: trait name "${row.name}" has no letters or digits`);
  return `${family}--${name}`;
}
