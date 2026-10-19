import { createRelationService, type RelationService } from '@atlas/core';
import { traitRepository } from './composition-root';

let relationService: Promise<RelationService> | undefined;

/**
 * The relations of the traits (Enabled by, Enables, the keyword views, the focus picker): what the Synergy pages call. The
 * dataset is the one the search loaded, if it did; a call after a failure tries again. It is built apart from the other services
 * so that the relation code goes with the Synergy route and not into the first script (`relations-stay-lazy`, dependency-cruiser).
 */
export function loadRelationService(): Promise<RelationService> {
  relationService ??= createRelationService(traitRepository).catch((failure: unknown) => {
    relationService = undefined;
    throw failure;
  });
  return relationService;
}
