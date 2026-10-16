import { extractKeywords, type KeywordExtractor } from '../extraction/extract-keywords';
import type { IdentifiedTraitRow, Trait } from '../model/trait';
import { doesStack } from './does-stack';
import { createFamilyMatcher } from './family-matcher';
import { parsePartyRequirement } from './party-requirement';
import { detectRandomDebuff } from './random-debuff';
import { classifyKind } from './trait-kind';

/**
 * Adds what can be derived from a row alone: its kind (R7), whether it stacks (R4), a random debuff (R5), for
 * masteries the family and the party requirement (R3), and its keywords. Hand-made corrections come after, from
 * `overrides.yaml`.
 */
export function enrichTraits(
  rows: readonly IdentifiedTraitRow[],
  extract: KeywordExtractor = extractKeywords,
): Trait[] {
  const familyMatcher = createFamilyMatcher(rows.map((row) => row.family));

  return rows.map((row) => {
    const kind = classifyKind(row);
    const isMastery = kind === 'mastery';
    return {
      id: row.id,
      name: row.name,
      creature: isMastery || kind === 'backer' ? null : row.creature,
      family: row.family,
      class: row.class,
      kind,
      description: row.description,
      material: row.material,
      stacks: doesStack(row.description),
      randomDebuff: detectRandomDebuff(row.description),
      masteryFamily: isMastery ? row.family : null,
      partyRequirement: isMastery ? parsePartyRequirement(row.description, familyMatcher) : null,
      keywords: extract(row.description),
    };
  });
}
