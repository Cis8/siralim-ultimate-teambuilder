import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';
import type { KeywordKey, Trait, TraitId } from '@atlas/core';
import { carriedSearch, keywordSearch, traitSearch, type CarriedParty } from './carried-search';
import { partySession } from './composition-root';
import { encodeTab } from './page-tab';
import { synergySearch } from './synergy-address';
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

/** The address of Explore searching for exactly this trait, carrying the party. */
export const exploreTraitHref = (trait: Pick<Trait, 'name' | 'family'>): ResolvedPathname =>
  exploreHref(traitSearch(trait, carriedNow()));

/** The address of Explore listing the traits that apply a keyword or rely on it, carrying the party and the artifact filter. */
export const exploreKeywordHref = (
  key: KeywordKey,
  side: 'applies' | 'uses',
  artifactOnly: boolean,
): ResolvedPathname => exploreHref(keywordSearch(key, side, artifactOnly, carriedNow()));

/** What a link from one Synergy page to another carries: the party, and the artifact filter, which the person keeps as they go. */
export const synergyLinkSearch = (matOnly: boolean): string =>
  synergySearch({ matOnly, section: undefined, ...carriedNow() });

/** The address of a trait's page for a link on Explore or in the party panel: it carries the party, and the artifact filter is off. */
export const synergiesOfHref = (traitId: TraitId): ResolvedPathname =>
  synergyHref({ page: 'trait', traitId }, synergyLinkSearch(false));

/** Opens a trait's page as a step of the history, carrying the party and the artifact filter. */
export function openTrait(traitId: TraitId, matOnly = false): Promise<void> {
  return goto(synergyHref({ page: 'trait', traitId }, synergyLinkSearch(matOnly)));
}
