import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { TraitId } from '@atlas/core';
import { carriedSearch, type CarriedParty } from './carried-search';
import { partySession } from './composition-root';
import { encodeTab } from './page-tab';
import type { SynergyPlace } from './synergy-place';

// Each address is made by `resolve` (the base path, the route's parameters) and typed as what it makes: the lint rule that
// asks for it to be used on every link and every `goto` accepts a value of that type. An empty query is left off, so that a
// link for an empty party is the plain address of the page.

/** The address of Explore, with `search` (a query string without its `?`). */
export const exploreHref = (search = ''): ResolvedPathname => (search === '' ? resolve('/') : resolve(`/?${search}`));

/** The address of a page of the Synergy explorer, with `search`. */
export function synergyHref(place: SynergyPlace, search = ''): ResolvedPathname {
  switch (place.page) {
    case 'picker':
      return search === '' ? resolve('/synergy') : resolve(`/synergy?${search}`);
    case 'trait':
      return search === ''
        ? resolve('/synergy/[traitId]', { traitId: place.traitId })
        : resolve(`/synergy/[traitId]?${search}`, { traitId: place.traitId });
    case 'keyword':
      return search === ''
        ? resolve('/synergy/kw/[slug]', { slug: place.slug })
        : resolve(`/synergy/kw/[slug]?${search}`, { slug: place.slug });
  }
}

/** The three places the header and the foot bars link to, each carrying the party (ADR-0011). */
export interface AppLinks {
  readonly explore: ResolvedPathname;
  readonly party: ResolvedPathname;
  readonly synergies: ResolvedPathname;
}

export function appLinks(carried: CarriedParty): AppLinks {
  return {
    explore: exploreHref(carriedSearch(carried)),
    // The tab is where a narrow screen shows the party; a wide one shows it beside the list whatever the tab.
    party: exploreHref(carriedSearch(carried, encodeTab('party'))),
    synergies: synergyHref({ page: 'picker' }, carriedSearch(carried)),
  };
}

/** The party the session holds, as a link carries it. Read in a template or an effect it follows the party. */
export const carriedNow = (): CarriedParty => ({
  party: partySession.partyState,
  datasetVersion: partySession.datasetVersion,
});

/** Opens a trait's page as a step of the history, carrying the party. */
export function openTrait(traitId: TraitId): Promise<void> {
  return goto(synergyHref({ page: 'trait', traitId }, carriedSearch(carriedNow())));
}
