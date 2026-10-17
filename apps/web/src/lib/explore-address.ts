import { encodeExploreState, EXPLORE_PARAMS, type ExploreState } from '@atlas/core';

/**
 * The address that stands for `state` on the page `current` is at. The Explore parameters are replaced and whatever else
 * the address carries (the party, the tab) stays as it is.
 */
export function exploreAddress(current: URL, state: ExploreState): URL {
  const params = new URLSearchParams(current.search);
  for (const name of EXPLORE_PARAMS) params.delete(name);
  for (const [name, value] of encodeExploreState(state)) params.append(name, value);

  const address = new URL(current);
  address.search = readable(params.toString());
  return address;
}

/**
 * The colon of `a:vulnerable` and the comma between two classes are legal in a query and are what SPEC §7 shows: left as
 * they are, a link pasted into a chat can be read. A comma that belongs to a name is `%2C` in the value, so it is `%252C`
 * here and keeps its escape.
 */
const readable = (search: string): string => search.replaceAll('%3A', ':').replaceAll('%2C', ',');
