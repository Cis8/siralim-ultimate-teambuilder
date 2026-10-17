import type { ClassName, KeywordKey } from '../model/trait';

/**
 * The query fields a keyword facet stands for (QUERY_LANGUAGE §2): `applies` and `uses` for the role of a buff, debuff,
 * effect or event, `kw` for any other keyword (a mechanic) or any role.
 */
export const KEYWORD_FILTER_FIELDS = ['applies', 'uses', 'kw'] as const;
export type KeywordFilterField = (typeof KEYWORD_FILTER_FIELDS)[number];

export interface KeywordFilter {
  readonly field: KeywordFilterField;
  readonly key: KeywordKey;
}

/** Whether a trait must have all the keyword filters or any of them. */
export const KEYWORD_MODES = ['all', 'any'] as const;
export type KeywordMode = (typeof KEYWORD_MODES)[number];

/** `book` is the order of the dataset: by family, then trait name (SPEC §6), not the order of the rows of the sheet. */
export const SORT_KEYS = ['book', 'class', 'az'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/**
 * Everything the Explore view shows and filters by (SPEC §8.1), and nothing it derives: the URL carries it (ADR-0005,
 * `encodeExploreState`). Class names and keyword keys are lower case, as the codec writes and reads them.
 */
export interface ExploreState {
  /** What is in the query bar, as typed. */
  readonly query: string;
  /** Any of these classes (lower case), in the order they were chosen. */
  readonly classes: readonly ClassName[];
  readonly keywords: readonly KeywordFilter[];
  readonly keywordMode: KeywordMode;
  /** Only traits with a material: the ones that can sit in an Artifact slot. */
  readonly artifactEligible: boolean;
  /** Only traits that say "This trait does not stack". */
  readonly doesNotStack: boolean;
  readonly sort: SortKey;
}

/** No query, no filter, the order of the compendium: what an address with no parameter stands for. */
export const initialExploreState: ExploreState = {
  query: '',
  classes: [],
  keywords: [],
  keywordMode: 'all',
  artifactEligible: false,
  doesNotStack: false,
  sort: 'book',
};
