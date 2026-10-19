import { encodeExploreState, encodePartyState, EXPLORE_PARAMS, PARTY_PARAMS } from '@atlas/core';
import type { PageState } from './page-state';
import { encodeTab, TAB_PARAMS } from './page-tab';
import { readableSearch } from './readable-search';

/**
 * The address that stands for `state` on the page `current` is at. The parameters of the search, of the party and of the
 * tab are replaced, and whatever else the address carries stays as it is.
 */
export function pageAddress(current: URL, { explore, party, tab, datasetVersion }: PageState): URL {
  const params = new URLSearchParams(current.search);
  for (const name of [...EXPLORE_PARAMS, ...PARTY_PARAMS, ...TAB_PARAMS]) params.delete(name);
  for (const [name, value] of encodeExploreState(explore)) params.append(name, value);
  for (const [name, value] of encodePartyState(party, datasetVersion ?? '')) params.append(name, value);
  for (const [name, value] of encodeTab(tab)) params.append(name, value);

  const address = new URL(current);
  address.search = readableSearch(params.toString());
  return address;
}
