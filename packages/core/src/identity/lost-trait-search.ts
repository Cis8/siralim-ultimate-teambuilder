import type { TraitId } from '../model/trait';

/** What to look for when the dataset has no trait with an id a shared party holds (SPEC §5). */
export interface LostTraitSearch {
  /** The words of the trait's name as far as its id keeps them; empty when there are none. */
  readonly name: string;
  /** A query for the trait names that contain them; empty when `name` is. */
  readonly query: string;
}

/**
 * The search that offers itself for an id nobody knows. The id is `<family>--<name>` as slugs (SPEC §5), so the name is
 * what follows the family, with the hyphens read as blanks: capitals, apostrophes and punctuation are gone, so the words
 * may not match the name of a trait that was renamed, but they do for most that were only moved or removed. Anything that
 * is not a letter or a digit is a blank, which is also what keeps a quote out of the query.
 */
export function lostTraitSearch(id: TraitId): LostTraitSearch {
  const separator = id.indexOf('--');
  const slug = separator < 0 ? id : id.slice(separator + 2);
  const name = slug.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return { name, query: name === '' ? '' : `trait:"${name}"` };
}
