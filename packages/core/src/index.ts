/**
 * Version of the dataset file format shared by the pipeline (writer) and the web app (reader).
 * Bump it on any breaking change to the emitted JSON.
 */
export const DATASET_SCHEMA_VERSION = 1;

export { assignTraitIds } from './identity/assign-trait-ids';
export { slugify } from './identity/slugify';
export { traitIdBase } from './identity/trait-id-base';
export type {
  ClassName,
  IdentifiedTraitRow,
  KeywordHit,
  KeywordKey,
  PartyRequirement,
  RandomDebuffSource,
  Trait,
  TraitId,
  TraitKind,
  TraitRow,
} from './model/trait';
