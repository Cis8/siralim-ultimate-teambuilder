export { createKeywordExtractor, extractKeywords, type KeywordExtractor } from './extraction/extract-keywords';
export { createKeywordMatcher, type KeywordMatch, type KeywordMatcher } from './extraction/keyword-matcher';
export { assignRoles, type RoleOptions } from './extraction/role-heuristic';
export { isStatSense } from './extraction/stat-sense';
export { enrichTraits } from './enrichment/enrich-traits';
export { detectConditionalSources } from './enrichment/conditional-sources';
export { writtenForms as familyWrittenForms } from './enrichment/family-matcher';
export { CREATURE_CLASSES, KNOWN_CLASSES } from './enrichment/trait-kind';
export { assignTraitIds } from './identity/assign-trait-ids';
export { lostTraitSearch, type LostTraitSearch } from './identity/lost-trait-search';
export { slugify } from './identity/slugify';
export { traitIdBase } from './identity/trait-id-base';
export type {
  ClassName,
  IdentifiedTraitRow,
  KeywordActor,
  KeywordHit,
  KeywordKey,
  KeywordKind,
  KeywordReference,
  KeywordRole,
  PartyRequirement,
  RandomDebuffSource,
  Trait,
  TraitId,
  TraitKind,
  TraitRow,
} from './model/trait';
export { KEYWORD_ACTORS } from './model/trait';
export { canBeDependency, hasActor, hasRole } from './model/keyword-kind';
export { DATASET_SCHEMA_VERSION, MANIFEST_FILE_NAME, datasetFileName } from './model/dataset';
export type { DatasetManifest, TraitDataset } from './model/dataset';
export { compareText } from './text/compare-text';
export { tokenize } from './query/lexer';
export { parseQuery, type ParseResult } from './query/parser';
export type { AndNode, NotNode, OrNode, QueryNode, TermNode } from './query/ast';
export type { DiagnosticFix, DiagnosticSeverity, QueryDiagnostic, SyntaxDiagnosticCode } from './query/diagnostic';
export { applyEdit, caretAfterEdit, type TextEdit } from './query/text-edit';
export { withSyntaxFixes } from './query/syntax-fixes';
export type { Span } from './query/span';
export type { FieldName, SymbolToken, TermToken, Token } from './query/token';
export type {
  FieldDefinition,
  MatchMode,
  TraitMatcher,
  ValueChoice,
  ValueDomain,
  VocabularyColumn,
} from './query/field';
export { closestMatch } from './query/closest-match';
export type { LintContext, LintFinding, LintRule } from './query/lint-rule';
export { createLintRegistry, LintRegistryError, type LintRegistry } from './query/lint-registry';
export { lintRegistry } from './query/lint-rules';
export { lintQuery, MAX_LINTED_LENGTH, type LintOptions } from './query/lint-query';
export { createFieldRegistry, FieldRegistryError, type FieldRegistry } from './query/field-registry';
export { fieldRegistry } from './query/fields';
export { indexTrait, type ColumnName, type IndexedTrait } from './query/indexed-trait';
export { parseKeywordReference, writeKeywordReference } from './query/keyword-reference';
export { createTraitIndex, type TraitIndex } from './query/trait-index';
export { createQueryVocabulary, type QueryVocabulary } from './query/query-vocabulary';
export { evaluate } from './query/evaluate';
export { visitQuery, type QueryVisitor } from './query/visitor';
export { createHighlighter, type Highlighter } from './query/highlight';
export { serialise, serialiseTerm } from './query/serialise';
export { queryChips, removeChip, toggleChipNot, type QueryChip } from './query/chips';
export { suggestionContext, type SuggestionContext } from './suggest/context';
export type { Candidate, Suggestion, SuggestionKind } from './suggest/suggestion';
export { MAX_SUGGESTIONS } from './suggest/rank-candidates';
export {
  createSuggestionRegistry,
  SuggestionRegistryError,
  suggestionProvider,
  type ContextKind,
  type ContextOf,
  type SuggestionEnvironment,
  type SuggestionProvider,
  type SuggestionRegistry,
} from './suggest/suggestion-registry';
export { suggestionRegistry } from './suggest/suggestion-providers';
export { suggestQuery } from './suggest/suggest-query';
export { acceptSuggestion } from './suggest/accept-suggestion';
export { ghostText } from './suggest/ghost-text';
export { withCounts, type CountedSuggestion } from './suggest/with-counts';
export type {
  BuffEntry,
  DebuffEntry,
  EffectEntry,
  EventAlias,
  EventEntry,
  EventGroup,
  FlagEntry,
  MechanicEntry,
  TaxonomyEntry,
  TriggerPhase,
} from './taxonomy/entry';
export { canHaveActor, EVENT_GROUPS, TRIGGER_PHASES } from './taxonomy/entry';
export { createTaxonomy, TaxonomyError, type Taxonomy } from './taxonomy/registry';
export { taxonomy } from './taxonomy/taxonomy';
export { DatasetLoadError, type TraitRepository } from './repository/trait-repository';
export { createMemoryTraitRepository } from './repository/memory-trait-repository';
export { readDataset, readManifest } from './repository/read-dataset';
export type { Alternative, SharedKey, SharedRole } from './relations/alternatives';
export type { KeyRelations } from './relations/key-relations';
export type { CoApplied, KeywordStats, KeywordVerdict, KeywordView } from './relations/keyword-view';
export { createRelationIndex, type RelationIndex } from './relations/relation-index';
export type { RelationOptions } from './relations/relation-options';
export type { SameFamily } from './relations/same-family';
export type { SameTrigger, TriggerMatch } from './relations/same-trigger';
export type {
  KeyLane,
  KeyLink,
  RelatedTrait,
  RelationSide,
  SourceStrength,
  TraitRelations,
} from './relations/trait-relations';
export { createSearchService, type SearchOutcome, type SearchService } from './search/search-service';
export { createLintContext, type LintSource } from './search/lint-context';
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
export { facetCount, FACET_KEYWORD_KINDS } from './explore/facets';
export type { ClassFacet, FacetKeywordKind, Facets, KeywordFacet, KeywordSide, SideCounts } from './explore/facets';
export { decodeExploreState, encodeExploreState, EXPLORE_PARAMS } from './explore/explore-url';
export type { ParamReader, UrlParams } from './url/url-params';
export { descriptionParts, type DescriptionPart, type TextPiece } from './explore/description-parts';
export { clickGoal, clickKeyword, isClickOn, type ClickedKeyword, type ClickGoal } from './explore/keyword-click';
export {
  hasClass,
  hasKeywordFilter,
  hasKeywordSide,
  toggleClass,
  toggleKeywordFilter,
  toggleKeywordSide,
  type KeywordSideFilter,
} from './explore/facet-toggles';
export { actorSet, type ActorSet } from './explore/actor-set';
export { eventActors, setEventActors, toggleActor } from './explore/event-actors';
export { filterChips, removeFilterChip, type FilterChip } from './explore/filter-chips';
export { clearFilters } from './explore/clear-filters';
export { activeFilterCounts, FILTER_SECTIONS, type FilterSection } from './explore/active-filter-counts';
export {
  emptyParty,
  filledSlots,
  isEmptyParty,
  MEMBER_INDEXES,
  sameSlot,
  SLOT_NAMES,
  SLOT_POSITIONS,
  traitAt,
  withTraitAt,
  type MemberIndex,
  type Party,
  type PartyMember,
  type SlotName,
  type SlotPosition,
} from './party/party';
export {
  partyCoverage,
  type Dependency,
  type DependencyStatus,
  type DuplicateTrait,
  type PartyCoverage,
  type TraitLookup,
} from './party/party-coverage';
export { applyCommand, type CommandResult, type PartyCommand, type Refusal } from './party/party-command';
export {
  canRedo,
  canUndo,
  createPartyHistory,
  executeCommand,
  redo,
  undo,
  type PartyEdit,
  type PartyHistory,
} from './party/party-history';
export type { Placement, SlotRule } from './party/slot-rule';
export { createSlotRuleRegistry, SlotRuleRegistryError, type SlotRuleRegistry } from './party/slot-rule-registry';
export { slotRules } from './party/slot-rules';
export { allowedSlots } from './party/allowed-slots';
export { firstEmptySlot, nextEmptySlot, type TargetStrategy } from './party/target-strategy';
export { decodePartyState, encodePartyState, PARTY_PARAMS, type SharedParty } from './party/party-url';
export { initialPartyState, samePartyState, type PartyState } from './party/party-state';
export {
  addTrait,
  addTraitAt,
  chooseTarget,
  clearParty,
  clearSlot,
  createPlanner,
  redoEdit,
  undoEdit,
  type AddResult,
  type Planner,
} from './party/planner';
