import type { PartyRequirement } from '../model/trait';
import type { FamilyMatcher } from './family-matcher';

// Wordings seen in compendium v2.0 (GAME_RULES R3). Each captures the part of the sentence that names the families.
const ALL_FAMILY = /\bif all (?:the )?creatures in your party (?:are|belong to)\b([^,.]*)/i;
const DISTINCT_FAMILY_COUNT = /\bif you have (\d+) different ([^,.]*?) in your party\b/i;
const CLASS_DIVERSITY = /\bfor each different class\b|\ba creature from each class\b/i;
const PER_FAMILY_COUNT = /\bfor each (?!time\b)([^.]*?) (?:fighting on your side|in your party)\b/i;
/** What precedes a family when the effect is about the party's own creatures of that family. */
const OWNED = /\b[Yy]our (?:other )?$/;

/**
 * What the party needs for a mastery trait to matter, read from its text (GAME_RULES R3). The conditions are tried in
 * this order, so "If all the creatures … are X, … for each enemy …" is `allFamily`, not a count.
 *
 * `families` are the ones the condition names, resolved against `matcher`; an unknown family leaves the list empty
 * rather than guessing.
 */
export function parsePartyRequirement(description: string, matcher: FamilyMatcher): PartyRequirement {
  const allFamily = ALL_FAMILY.exec(description);
  if (allFamily) return { type: 'allFamily', families: familiesNamedIn(allFamily[1], matcher) };

  const distinct = DISTINCT_FAMILY_COUNT.exec(description);
  if (distinct) {
    return {
      type: 'distinctFamilyCount',
      families: familiesNamedIn(distinct[2], matcher),
      count: Number(distinct[1]),
    };
  }

  if (CLASS_DIVERSITY.test(description)) return { type: 'classDiversity' };

  const perFamily = PER_FAMILY_COUNT.exec(description);
  if (perFamily) return { type: 'perFamilyCount', families: familiesNamedIn(perFamily[1], matcher) };

  const targeted = unique(
    matcher
      .mentionsIn(description)
      .filter((mention) => OWNED.test(description.slice(0, mention.index)))
      .map((mention) => mention.family),
  );
  return targeted.length > 0 ? { type: 'familyScoped', families: targeted } : { type: 'none' };
}

function familiesNamedIn(clause: string | undefined, matcher: FamilyMatcher): string[] {
  return unique(matcher.mentionsIn(clause ?? '').map((mention) => mention.family));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
