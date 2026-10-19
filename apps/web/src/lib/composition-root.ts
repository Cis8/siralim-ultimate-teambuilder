import { asset } from '$app/paths';
import {
  createRelationService,
  createSearchService,
  loadOnce,
  type RelationService,
  type SearchService,
} from '@atlas/core';
import { createStaticTraitRepository } from './data/static-trait-repository';
import { timeSearches } from './search-timing';

// `asset` takes only the names of files that exist when the app is built, and the dataset file is renamed whenever the
// data changes: the manifest is the one stable name, so the files are found next to it.
const dataDirectory = (): string => asset('data/manifest.json').replace(/[^/]*$/u, '');

// Every service is built from this one reader, which fetches the dataset when the first of them asks and gives it to the rest.
const repository = loadOnce(
  createStaticTraitRepository({
    fetch: (url, init) => fetch(url, init),
    urlOf: (fileName) => dataDirectory() + fileName,
  }),
);

let searchService: Promise<SearchService> | undefined;
let relationService: Promise<RelationService> | undefined;

/**
 * The one place the app's services are built from their adapters. The dataset is loaded on the first call of any service and
 * shared by every caller and by the other service; a call after a failure tries again. Call them in the browser: the
 * prerendered shell has no data to load.
 */
export function loadSearchService(): Promise<SearchService> {
  searchService ??= createSearchService(repository)
    .then((service) => timeSearches(service))
    .catch((failure: unknown) => {
      searchService = undefined;
      throw failure;
    });
  return searchService;
}

/** The relations of the traits (Enabled by, Enables, the keyword views, the focus picker): what the Synergy pages call. */
export function loadRelationService(): Promise<RelationService> {
  relationService ??= createRelationService(repository).catch((failure: unknown) => {
    relationService = undefined;
    throw failure;
  });
  return relationService;
}
