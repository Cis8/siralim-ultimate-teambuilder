export { createKeywordExtractor, extractKeywords, type KeywordExtractor } from './extraction/extract-keywords';
export { createKeywordMatcher, type KeywordMatch, type KeywordMatcher } from './extraction/keyword-matcher';
export { assignRoles, type RoleOptions } from './extraction/role-heuristic';
export { enrichTraits } from './enrichment/enrich-traits';
export { detectConditionalSources } from './enrichment/conditional-sources';
export { writtenForms as familyWrittenForms } from './enrichment/family-matcher';
export { CREATURE_CLASSES, KNOWN_CLASSES } from './enrichment/trait-kind';
export { assignTraitIds } from './identity/assign-trait-ids';
export { slugify } from './identity/slugify';
export { traitIdBase } from './identity/trait-id-base';
export type {
  ClassName,
  IdentifiedTraitRow,
  KeywordHit,
  KeywordKey,
  KeywordKind,
  KeywordRole,
  PartyRequirement,
  RandomDebuffSource,
  Trait,
  TraitId,
  TraitKind,
  TraitRow,
} from './model/trait';
export { hasRole } from './model/keyword-kind';
export { DATASET_SCHEMA_VERSION, MANIFEST_FILE_NAME, datasetFileName } from './model/dataset';
export type { DatasetManifest, TraitDataset } from './model/dataset';
export { compareText } from './text/compare-text';
export { tokenize } from './query/lexer';
export { parseQuery, type ParseResult } from './query/parser';
export type { AndNode, NotNode, OrNode, QueryNode, TermNode } from './query/ast';
export type { QueryDiagnostic, SyntaxDiagnosticCode } from './query/diagnostic';
export type { Span } from './query/span';
export type { FieldName, SymbolToken, TermToken, Token } from './query/token';
export type { FieldDefinition, TraitMatcher } from './query/field';
export { createFieldRegistry, FieldRegistryError, type FieldRegistry } from './query/field-registry';
export { fieldRegistry } from './query/fields';
export { indexTrait, type ColumnName, type IndexedTrait } from './query/indexed-trait';
export { createTraitIndex, type TraitIndex } from './query/trait-index';
export { evaluate } from './query/evaluate';
export { visitQuery, type QueryVisitor } from './query/visitor';
export { createHighlighter, type Highlighter } from './query/highlight';
export { serialise } from './query/serialise';
export { queryChips, removeChip, toggleChipNot, type QueryChip } from './query/chips';
export type {
  BuffEntry,
  DebuffEntry,
  EffectEntry,
  FlagEntry,
  MechanicEntry,
  TaxonomyEntry,
  TriggerEntry,
  TriggerPhase,
} from './taxonomy/entry';
export { TRIGGER_PHASES } from './taxonomy/entry';
export { createTaxonomy, TaxonomyError, type Taxonomy } from './taxonomy/registry';
export { taxonomy } from './taxonomy/taxonomy';
export { DatasetLoadError, type TraitRepository } from './repository/trait-repository';
export { createMemoryTraitRepository } from './repository/memory-trait-repository';
export { readDataset, readManifest } from './repository/read-dataset';
export { createSearchService, type SearchOutcome, type SearchService } from './search/search-service';
export {
  initialExploreState,
  KEYWORD_FILTER_FIELDS,
  KEYWORD_MODES,
  SORT_KEYS,
  type ExploreState,
  type KeywordFilter,
  type KeywordFilterField,
  type KeywordMode,
  type SortKey,
} from './explore/explore-state';
export { FACET_KEYWORD_KINDS } from './explore/facets';
export type { ClassFacet, FacetKeywordKind, Facets, KeywordFacet } from './explore/facets';
export {
  decodeExploreState,
  encodeExploreState,
  EXPLORE_PARAMS,
  type ExploreParams,
  type ParamReader,
} from './explore/explore-url';
export { descriptionParts, type DescriptionPart, type TextPiece } from './explore/description-parts';
export { clickGoal, clickKeyword, isClickOn, type ClickedKeyword, type ClickGoal } from './explore/keyword-click';
export { hasClass, hasKeywordFilter, toggleClass, toggleKeywordFilter } from './explore/facet-toggles';
export { filterChips, removeFilterChip, type FilterChip } from './explore/filter-chips';
