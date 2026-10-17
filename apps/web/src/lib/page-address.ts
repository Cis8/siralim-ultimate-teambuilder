import { encodeExploreState, encodePartyState, EXPLORE_PARAMS, PARTY_PARAMS } from '@atlas/core';
import type { PageState } from './page-state';

/**
 * The address that stands for `state` on the page `current` is at. The parameters of the search and of the party are
 * replaced, and whatever else the address carries (the tab) stays as it is.
 */
export function pageAddress(current: URL, { explore, party, datasetVersion }: PageState): URL {
  const params = new URLSearchParams(current.search);
  for (const name of [...EXPLORE_PARAMS, ...PARTY_PARAMS]) params.delete(name);
  for (const [name, value] of encodeExploreState(explore)) params.append(name, value);
  for (const [name, value] of encodePartyState(party, datasetVersion ?? '')) params.append(name, value);

  const address = new URL(current);
  address.search = readable(params.toString());
  return address;
}

/**
 * The colon of `a:vulnerable` and the comma between two items are legal in a query and are what SPEC §7 shows: left as
 * they are, a link pasted into a chat can be read. A comma that belongs to a name is `%2C` in the value, so it is `%252C`
 * here and keeps its escape.
 */
const readable = (search: string): string => search.replaceAll('%3A', ':').replaceAll('%2C', ',');
