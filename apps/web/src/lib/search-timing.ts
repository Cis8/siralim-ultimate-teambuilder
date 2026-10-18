import type { SearchService } from '@atlas/core';

/** The name of the User Timing measure of a search: what the performance e2e (SPEC §Performance) reads. */
export const SEARCH_MEASURE = 'atlas:search';

/** The name of the measure of the query assist (the issues now, later the suggestions and their counts): what `assist-latency.test.ts` reads. */
export const ASSIST_MEASURE = 'atlas:assist';

/** What of `performance` is used to time: the clock and the measures of the timeline. */
export interface SearchClock {
  now(): number;
  measure(name: string, options: { start: number; end: number }): unknown;
  clearMeasures(name: string): void;
}

/**
 * `work` with every call timed on the page's timeline (User Timing: DevTools shows them in the Timings track). The measure
 * goes to whoever observes the timeline and is not kept in its buffer, which would grow with every key typed.
 */
function timed<Args extends readonly unknown[], Result>(
  name: string,
  work: (...args: Args) => Result,
  clock: SearchClock,
): (...args: Args) => Result {
  return (...args) => {
    const start = clock.now();
    try {
      return work(...args);
    } finally {
      clock.measure(name, { start, end: clock.now() });
      clock.clearMeasures(name);
    }
  };
}

/**
 * The service with every search it makes timed. A search is the part of a keystroke that grows with the dataset, and SPEC
 * §Performance puts a budget on it, the recount of the facets included.
 */
export function timeSearches(service: SearchService, clock: SearchClock = performance): SearchService {
  return { ...service, search: timed(SEARCH_MEASURE, (state) => service.search(state), clock) };
}

/**
 * The work of the query assist with every call timed, beside the search: ADR-0010 holds both to the same budget on every
 * keystroke, and the assist e2e reads it from the timeline.
 */
export function timeAssist<Args extends readonly unknown[], Result>(
  work: (...args: Args) => Result,
  clock: SearchClock = performance,
): (...args: Args) => Result {
  return timed(ASSIST_MEASURE, work, clock);
}
