/**
 * Turns a name into lowercase ASCII words joined by single hyphens, e.g. `Mother’s Wrath` → `mothers-wrath`.
 *
 * - Accents are stripped (`é` → `e`).
 * - Apostrophes vanish without splitting the word; `&` reads as "and".
 * - Every other character outside `a-z0-9` is a separator, so letters with no ASCII decomposition (`ß`, `æ`) are
 *   dropped. Callers that need uniqueness must not rely on the result alone (see `assignTraitIds`).
 *
 * Returns an empty string when nothing is left.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/['‘’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
