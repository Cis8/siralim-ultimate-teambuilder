import { asset } from '$app/paths';
import { createSearchService, loadOnce, type SearchService } from '@atlas/core';
import { tick } from 'svelte';
import { createStaticTraitRepository } from './data/static-trait-repository';
import { createLastPartyStore } from './last-party-store';
import { createPartySession } from './party-session';
import { createSearchHistorySession } from './search-history-session';
import { createSearchHistoryStore } from './search-history-store';
import { timeSearches } from './search-timing';

// `asset` takes only the names of files that exist when the app is built, and the dataset file is renamed whenever the
// data changes: the manifest is the one stable name, so the files are found next to it.
const dataDirectory = (): string => asset('data/manifest.json').replace(/[^/]*$/u, '');

// Every service is built from this one reader, which fetches the dataset when the first of them asks and gives it to the rest.
export const traitRepository = loadOnce(
  createStaticTraitRepository({
    fetch: (url, init) => fetch(url, init),
    urlOf: (fileName) => dataDirectory() + fileName,
  }),
);

let searchService: Promise<SearchService> | undefined;

/**
 * Where the app's services are built from their adapters: the search here, the relations of the Synergy pages in
 * `relation-composition.ts`, which is kept apart so that their code stays out of the first script. The dataset is loaded on the
 * first call of any service and shared by every caller and by the other service; a call after a failure tries again. Call them
 * in the browser: the prerendered shell has no data to load.
 */
export function loadSearchService(): Promise<SearchService> {
  searchService ??= createSearchService(traitRepository)
    .then((service) => timeSearches(service))
    .catch((failure: unknown) => {
      searchService = undefined;
      throw failure;
    });
  return searchService;
}

/**
 * The party every page shares, with its undo history (ADR-0011). It is made once, at module level: the prerender runs no page code
 * that reads or changes it, and in the browser there is one visitor, so it is never one person's party shown to another.
 */
export const partySession = createPartySession({
  store: createLastPartyStore(() => (typeof localStorage === 'undefined' ? undefined : localStorage)),
  rendered: tick,
});

/** The recent and saved searches, made once like the party (SPEC §8.3). The page reads what the browser kept once it runs (`load`). */
export const searchHistory = createSearchHistorySession({
  store: createSearchHistoryStore(() => (typeof localStorage === 'undefined' ? undefined : localStorage)),
});
