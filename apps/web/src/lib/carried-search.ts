import {
  encodeExploreState,
  encodePartyState,
  initialExploreState,
  serialiseTerm,
  type PartyState,
  type Trait,
  type UrlParams,
} from '@atlas/core';
import { readableSearch } from './readable-search';

/** The party a link takes to another page: the address is the source of truth (ADR-0005), so a page only knows the party it is told. */
export interface CarriedParty {
  readonly party: PartyState;
  /** The version the party is written under; `null` while neither the data nor the address has one. */
  readonly datasetVersion: string | null;
}

/**
 * The query string of a link to another page of the app (without the `?`): the party it carries, then `extra`. Empty when there
 * is nothing to say, so that a link to a page for an empty party is the plain address of that page.
 */
export function carriedSearch({ party, datasetVersion }: CarriedParty, extra: UrlParams = []): string {
  const params = new URLSearchParams();
  for (const [name, value] of [...encodePartyState(party, datasetVersion ?? ''), ...extra]) params.append(name, value);
  return readableSearch(params.toString());
}

/**
 * The query string of a link to Explore that finds this trait and no other: the name and the family it is filed under, which its
 * id is made of (SPEC §5). It carries the party as every link does.
 */
export function traitSearch({ name, family }: Pick<Trait, 'name' | 'family'>, carried: CarriedParty): string {
  const query = `${serialiseTerm('trait', name)} ${serialiseTerm('family', family)}`;
  return carriedSearch(carried, encodeExploreState({ ...initialExploreState, query }));
}
