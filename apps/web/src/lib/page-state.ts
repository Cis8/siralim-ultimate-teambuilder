import type { ExploreState, PartyState } from '@atlas/core';
import type { PageTab } from './page-tab';

/** Everything the address of the page stands for (SPEC §7): the search, the party and the tab. */
export interface PageState {
  readonly explore: ExploreState;
  readonly party: PartyState;
  /** The view a narrow screen shows; a wide one shows them all and ignores it. */
  readonly tab: PageTab;
  /**
   * The dataset version a party is written under: the one of the dataset in use, or while it loads the one the address
   * stated, so that a link opened before the data arrives is written back as it was. `null` when there is neither.
   */
  readonly datasetVersion: string | null;
}
