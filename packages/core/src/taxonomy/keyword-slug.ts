import { slugify } from '../identity/slugify';
import type { KeywordKey } from '../model/trait';

/**
 * How a key is written in an address (`/synergy/kw/<slug>`, ADR-0011): `mega magic` is `mega-magic`. Lower case letters, digits
 * and single hyphens, so it needs no escaping in a path. The taxonomy refuses keys that share a slug or have none.
 */
export function keywordSlug(key: KeywordKey): string {
  return slugify(key);
}

/**
 * The key among `keys` that `slug` is the address of, `undefined` for any other text. The slug is read exactly, so that a
 * page has one address; `keys` are the ones that have a page, which an event's key (`attack`) does not.
 */
export function keywordFromSlug(slug: string, keys: readonly KeywordKey[]): KeywordKey | undefined {
  return keys.find((key) => keywordSlug(key) === slug);
}
