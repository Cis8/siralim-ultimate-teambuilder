import { initialExploreState, type SearchOutcome, type SearchService, type Trait } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { ASSIST_MEASURE, SEARCH_MEASURE, timeAssist, timeSearches } from './search-timing';

const outcome = { traits: [] } as unknown as SearchOutcome;
const someTrait = { id: 'a-trait' } as Trait;

const vocabulary = { class: ['Life'], family: [], creature: [], name: ['A Trait'] };

const service = (searched: unknown[] = []): SearchService => ({
  datasetVersion: '2.0',
  traitCount: 1,
  traits: [someTrait],
  vocabulary,
  trait: (id) => (id === someTrait.id ? someTrait : undefined),
  search: (state) => {
    searched.push(state);
    return outcome;
  },
  countMatches: (_state, query) => query.length,
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
    expect(timed.traits).toEqual([someTrait]);
    expect(timed.vocabulary).toBe(vocabulary);
    expect(timed.countMatches(initialExploreState, 'weak')).toBe(4);
  });
});

describe('timeAssist', () => {
  it('measures each call as the assist, from the moment it starts to the moment it ends', () => {
    const timing = timeline(3, 5, 8, 8.25);
    const lint = timeAssist((source: string) => source.length, timing);

    lint('weak');
    lint('snared');

    expect(timing.calls.filter((call) => call.startsWith('measure'))).toEqual([
      `measure ${ASSIST_MEASURE} 3-5`,
      `measure ${ASSIST_MEASURE} 8-8.25`,
    ]);
  });

  it('keeps no entry of the measure, and is a separate measure from the search', () => {
    const timing = timeline(0, 1);

    timeAssist(() => undefined, timing)();

    expect(timing.calls).toEqual([`measure ${ASSIST_MEASURE} 0-1`, `clear ${ASSIST_MEASURE}`]);
    expect(ASSIST_MEASURE).not.toBe(SEARCH_MEASURE);
  });

  it('hands over the arguments and returns the result of the work', () => {
    const calls: unknown[][] = [];
    const work = (source: string, caret: number | undefined): string => {
      calls.push([source, caret]);
      return `${source}!`;
    };

    const timed = timeAssist(work, timeline(0, 1, 2, 3));

    expect(timed('weak', 4)).toBe('weak!');
    expect(timed('snared', undefined)).toBe('snared!');
    expect(calls).toEqual([
      ['weak', 4],
      ['snared', undefined],
    ]);
  });

  it('measures a call that throws, and lets it throw', () => {
    const timing = timeline(0, 1);
    const failing = timeAssist(() => {
      throw new Error('a rule failed');
    }, timing);

    expect(() => {
      failing();
    }).toThrow('a rule failed');
    expect(timing.calls).toEqual([`measure ${ASSIST_MEASURE} 0-1`, `clear ${ASSIST_MEASURE}`]);
  });
});
