import type { KeywordHit } from '../model/trait';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as defaultTaxonomy } from '../taxonomy/taxonomy';
import { createKeywordMatcher } from './keyword-matcher';
import { assignRoles } from './role-heuristic';

/** Everything the extractor reads from a trait description: its keywords, with spans and, for buffs and debuffs, roles. */
export type KeywordExtractor = (description: string) => KeywordHit[];

export function createKeywordExtractor(taxonomy: Taxonomy): KeywordExtractor {
  const matcher = createKeywordMatcher(taxonomy);
  const activeForms = new Map(
    taxonomy
      .ofKind('effect')
      .flatMap((entry) =>
        entry.activePatterns === undefined
          ? []
          : [[entry.key, new Set(entry.activePatterns.map((form) => form.toLowerCase()))] as const],
      ),
  );
  const moments = new Set(
    taxonomy
      .ofKind('event')
      .filter((entry) => entry.moment === true)
      .map((entry) => entry.key),
  );
  return (description) => assignRoles(description, matcher.match(description), { activeForms, moments });
}

/** The extractor over the taxonomy of the app. The pipeline and the tests use this one, so they agree (ADR-0003). */
export const extractKeywords: KeywordExtractor = createKeywordExtractor(defaultTaxonomy);
