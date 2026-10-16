import { asset } from '$app/paths';
import { createSearchService, type SearchService } from '@atlas/core';
import { createStaticTraitRepository } from './data/static-trait-repository';

// `asset` takes only the names of files that exist when the app is built, and the dataset file is renamed whenever the
// data changes: the manifest is the one stable name, so the files are found next to it.
const dataDirectory = (): string => asset('data/manifest.json').replace(/[^/]*$/u, '');

let searchService: Promise<SearchService> | undefined;

/**
 * The one place the app's services are built from their adapters. The dataset is loaded on the first call and shared by
 * every caller; a call after a failure tries again. Call it in the browser: the prerendered shell has no data to load.
 */
export function loadSearchService(): Promise<SearchService> {
  searchService ??= createSearchService(
    createStaticTraitRepository({
      fetch: (url, init) => fetch(url, init),
      urlOf: (fileName) => dataDirectory() + fileName,
    }),
  ).catch((failure: unknown) => {
    searchService = undefined;
    throw failure;
  });
  return searchService;
}
