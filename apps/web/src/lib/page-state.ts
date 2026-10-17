import type { ExploreState, PartyState } from '@atlas/core';

/** Everything the address of the page stands for (SPEC §7): the search and the party. */
export interface PageState {
  readonly explore: ExploreState;
  readonly party: PartyState;
  /**
   * The dataset version a party is written under: the one of the dataset in use, or while it loads the one the address
   * stated, so that a link opened before the data arrives is written back as it was. `null` when there is neither.
   */
  readonly datasetVersion: string | null;
}
