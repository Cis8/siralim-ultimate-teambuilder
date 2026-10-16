import { compareText, type DebuffEntry, type BuffEntry, type Taxonomy, type Trait } from '@atlas/core';

/**
 * How the compendium and the canonical buff and debuff lists (wiki, Codex Reference) differ, for the report:
 * a name the compendium spells another way, and a canonical entry no trait mentions any more. Compendium v2.0 wins in
 * both cases (GAME_RULES R8); this only makes the difference visible. Empty when no trait has keywords, i.e. when the
 * extractor did not run.
 */
export function compareWithCanonicalLists(traits: readonly Trait[], taxonomy: Taxonomy): string[] {
  if (!traits.some((trait) => trait.keywords.length > 0)) return [];

  const writtenBy = countSpellings(traits);
  const statuses: readonly (BuffEntry | DebuffEntry)[] = [...taxonomy.ofKind('debuff'), ...taxonomy.ofKind('buff')];

  return statuses.flatMap((entry) => {
    const spellings = writtenBy.get(entry.key);
    if (spellings === undefined) return [`"${entry.label}" is in the canonical lists, but no trait mentions it.`];
    if (entry.canonicalName === undefined) return [];

    const list = [...spellings]
      .toSorted(([a, x], [b, y]) => y - x || compareText(a, b))
      .map(([spelling, count]) => `"${spelling}" in ${count} ${count === 1 ? 'trait' : 'traits'}`);
    return [`The canonical name "${entry.canonicalName}" is written ${list.join(' and ')}.`];
  });
}

/** For each keyword, how many traits write it each way. */
function countSpellings(traits: readonly Trait[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  for (const trait of traits) {
    const seen = new Set<string>();
    for (const hit of trait.keywords) {
      const spelling = trait.description.slice(hit.span[0], hit.span[1]);
      if (seen.has(`${hit.key}|${spelling}`)) continue;
      seen.add(`${hit.key}|${spelling}`);
      const spellings = result.get(hit.key) ?? new Map<string, number>();
      spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1);
      result.set(hit.key, spellings);
    }
  }
  return result;
}
