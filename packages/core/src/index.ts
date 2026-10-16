/**
 * Version of the dataset file format shared by the pipeline (writer) and the web app (reader).
 * Bump it on any breaking change to the emitted JSON.
 */
export const DATASET_SCHEMA_VERSION = 1;

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
export { MANIFEST_FILE_NAME, datasetFileName } from './model/dataset';
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
