import type { SearchService } from '@atlas/core';

/** The name of the User Timing measure of a search: what the performance e2e (SPEC §Performance) reads. */
export const SEARCH_MEASURE = 'atlas:search';

/** What of `performance` is used to time: the clock and the measures of the timeline. */
export interface SearchClock {
  now(): number;
  measure(name: string, options: { start: number; end: number }): unknown;
  clearMeasures(name: string): void;
}

/**
 * The service with every search it makes timed on the page's timeline (User Timing: DevTools shows them in the Timings
 * track). A search is the part of a keystroke that grows with the dataset, and SPEC §Performance puts a budget on it, the
 * recount of the facets included. The measure goes to whoever observes the timeline and is not kept in its buffer, which
 * would grow with every key typed.
 */
export function timeSearches(service: SearchService, clock: SearchClock = performance): SearchService {
  return {
    ...service,
    search: (state) => {
      const start = clock.now();
      const outcome = service.search(state);
      clock.measure(SEARCH_MEASURE, { start, end: clock.now() });
      clock.clearMeasures(SEARCH_MEASURE);
      return outcome;
    },
  };
}
