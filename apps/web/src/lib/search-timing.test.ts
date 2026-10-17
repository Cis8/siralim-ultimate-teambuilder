import { initialExploreState, type SearchOutcome, type SearchService, type Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { SEARCH_MEASURE, timeSearches } from './search-timing';

const outcome = { traits: [] } as unknown as SearchOutcome;
const someTrait = { id: 'a-trait' } as Trait;

const service = (searched: unknown[] = []): SearchService => ({
  datasetVersion: '2.0',
  traitCount: 1,
  trait: (id) => (id === someTrait.id ? someTrait : undefined),
  search: (state) => {
    searched.push(state);
    return outcome;
  },
});

/** A clock that reads the given times in turn, and the calls made on the timeline. */
function timeline(...readings: number[]) {
  const calls: string[] = [];
  return {
    calls,
    now: () => readings.shift() ?? Number.NaN,
    measure: (name: string, { start, end }: { start: number; end: number }) => {
      calls.push(`measure ${name} ${String(start)}-${String(end)}`);
    },
    clearMeasures: (name: string) => {
      calls.push(`clear ${name}`);
    },
  };
}

describe('timeSearches', () => {
  it('measures each search from the moment it starts to the moment it ends', () => {
    const timing = timeline(10, 14.5, 20, 21);
    const timed = timeSearches(service(), timing);

    timed.search(initialExploreState);
    timed.search(initialExploreState);

    expect(timing.calls.filter((call) => call.startsWith('measure'))).toEqual([
      `measure ${SEARCH_MEASURE} 10-14.5`,
      `measure ${SEARCH_MEASURE} 20-21`,
    ]);
  });

  it('hands the measure to whoever watches the timeline, and keeps no entry of it', () => {
    const timing = timeline(0, 1);

    timeSearches(service(), timing).search(initialExploreState);

    expect(timing.calls).toEqual([`measure ${SEARCH_MEASURE} 0-1`, `clear ${SEARCH_MEASURE}`]);
  });

  it('searches what the service searches and returns what it found', () => {
    const searched: unknown[] = [];
    const state = { ...initialExploreState, query: 'weak' };

    const found = timeSearches(service(searched), timeline(0, 1)).search(state);

    expect(found).toBe(outcome);
    expect(searched).toEqual([state]);
  });

  it('is the service it times in everything else', () => {
    const timed = timeSearches(service(), timeline());

    expect(timed.datasetVersion).toBe('2.0');
    expect(timed.traitCount).toBe(1);
    expect(timed.trait('a-trait')).toBe(someTrait);
    expect(timed.trait('gone')).toBeUndefined();
  });
});
