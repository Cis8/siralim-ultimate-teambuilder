import type { Trait, TraitId } from '../model/trait';
import type { TraitRepository } from '../repository/trait-repository';
import type { Taxonomy } from '../taxonomy/registry';
import { taxonomy as appTaxonomy } from '../taxonomy/taxonomy';
import { findTraits } from './find-traits';
import { memoiseRecent } from './lru-memo';
import { createRelationIndex, type RelationIndex } from './relation-index';
import type { RelationOptions } from './relation-options';

/** How many traits the service remembers the sections of: the trail of the Synergy page is 6 and Back walks it. */
const RECENT_FOCUSES = 32;

/**
 * What the Synergy pages call: the relation index of the dataset that was loaded, with the sections of a trait remembered, and
 * the trait lookup and the search for a focus that the pages need beside it. It never reads a trait itself.
 */
export interface RelationService extends RelationIndex {
  readonly datasetVersion: string;
  /** The trait an id stands for, `undefined` when the dataset does not know it. */
  trait(id: TraitId): Trait | undefined;
  /** The traits `text` points at by name, creature or family, best fit first, at most `limit`: what a focus picker lists. */
  findTraits(text: string, limit: number): readonly Trait[];
}

/**
 * Loads the dataset and builds the relation index over it. The sections of a trait (`relationsOf`, `alternativesOf`,
 * `sameTriggerOf`, `sameFamilyOf`) are remembered for the last 32 questions each (a trait, with or without the artifact
 * filter), so a page that draws again, or Back to a trait shown a moment ago, gets the very answer it had. The views of a
 * keyword cost a fraction of a millisecond for all 42 keys and are worked out each time.
 */
export async function createRelationService(
  repository: TraitRepository,
  taxonomy: Taxonomy = appTaxonomy,
): Promise<RelationService> {
  const { datasetVersion, traits } = await repository.load();
  const index = createRelationIndex(traits, taxonomy);
  const byId = new Map(traits.map((trait) => [trait.id, trait]));

  return {
    ...index,
    datasetVersion,
    trait: (id) => byId.get(id),
    findTraits: (text, limit) => findTraits(traits, text, limit),
    relationsOf: remembered((id, options) => index.relationsOf(id, options)),
    alternativesOf: remembered((id, options) => index.alternativesOf(id, options)),
    sameTriggerOf: remembered((id, options) => index.sameTriggerOf(id, options)),
    sameFamilyOf: remembered((id, options) => index.sameFamilyOf(id, options)),
  };
}

/** `ask` with the answers to the last questions kept. A question is a trait and whether the artifact filter is on. */
function remembered<Answer>(
  ask: (id: TraitId, options: RelationOptions) => Answer,
): (id: TraitId, options?: RelationOptions) => Answer {
  return memoiseRecent(
    RECENT_FOCUSES,
    (id: TraitId, options: RelationOptions = {}) => `${id}|${String(options.artifactOnly === true)}`,
    (id: TraitId, options: RelationOptions = {}) => ask(id, options),
  );
}
