import type { KeywordHit } from '../model/trait';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as defaultTaxonomy } from '../taxonomy/taxonomy';
import { createKeywordMatcher } from './keyword-matcher';
import { assignRoles } from './role-heuristic';

/** Everything the extractor reads from a trait description: its keywords, with spans and, for buffs and debuffs, roles. */
export type KeywordExtractor = (description: string) => KeywordHit[];

export function createKeywordExtractor(taxonomy: Taxonomy): KeywordExtractor {
  const matcher = createKeywordMatcher(taxonomy);
  return (description) => assignRoles(description, matcher.match(description));
}

/** The extractor over the taxonomy of the app. The pipeline and the tests use this one, so they agree (ADR-0003). */
export const extractKeywords: KeywordExtractor = createKeywordExtractor(defaultTaxonomy);
