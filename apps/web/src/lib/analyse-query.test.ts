import {
  createMemoryTraitRepository,
  createSearchService,
  DATASET_SCHEMA_VERSION,
  initialExploreState,
  type CountedSuggestion,
  type ExploreState,
  type SearchService,
  type Trait,
} from '@atlas/core';
import { describe, expect, it, vi } from 'vitest';
import { analyseQuery, COUNTS_PER_STEP, countNext, hasUncounted, optionsOf } from './analyse-query';

function trait(id: string, overrides: Partial<Trait> = {}): Trait {
  return {
    id,
    name: id,
    creature: 'Abomination Brute',
    family: 'Abomination',
    class: 'Death',
    kind: 'creature',
    description: 'Heals an ally.',
    material: null,
    stacks: true,
    randomDebuff: null,
    masteryFamily: null,
    partyRequirement: null,
    keywords: [],
    conditionalSources: [],
    ...overrides,
  };
}

const applies = (key: string): Trait['keywords'] => [{ key, kind: 'debuff', role: 'applies', span: [0, 1] }];

/** Three traits that apply Vulnerable (two of Death, one of Life) and one that applies Weak. */
async function serviceOfFour(): Promise<SearchService> {
  const traits = [
    trait('bruiser', { name: 'Bruiser', description: 'Applies Vulnerable.', keywords: applies('vulnerable') }),
    trait('crusher', { name: 'Crusher', description: 'Applies Vulnerable.', keywords: applies('vulnerable') }),
    trait('mender', {
      name: 'Mender',
      class: 'Life',
      description: 'Applies Vulnerable.',
      keywords: applies('vulnerable'),
    }),
    trait('wearer', { name: 'Wearer', description: 'Applies Weak.', keywords: applies('weak') }),
  ];
  return createSearchService(
    createMemoryTraitRepository({ schemaVersion: DATASET_SCHEMA_VERSION, datasetVersion: 'test', traits }),
  );
}

const typedAtTheEnd = (service: SearchService, text: string, filters: ExploreState = initialExploreState) =>
  analyseQuery(service, filters, text, text.length);

describe('analyseQuery', () => {
  it('finds the issues of the text, with the fix of each', async () => {
    const service = await serviceOfFour();

    const { issues } = typedAtTheEnd(service, 'clas:life ');

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'unknown-field', severity: 'error', fix: { label: 'Change to “class:”' } });
  });

  it('suggests what may be typed at the caret', async () => {
    const service = await serviceOfFour();

    const { suggestions } = typedAtTheEnd(service, 'applies:vul');

    expect(suggestions.map(({ insert }) => insert)).toEqual(['applies:vulnerable']);
  });

  it('counts a suggestion within the filters of the page: it is what Enter would show', async () => {
    const service = await serviceOfFour();
    const lifeOnly: ExploreState = { ...initialExploreState, classes: ['Life'] };

    const counted = (filters: ExploreState) => typedAtTheEnd(service, 'applies:vul', filters).suggestions[0]?.count;

    expect(counted(initialExploreState)).toBe(3);
    expect(counted(lifeOnly)).toBe(1);
  });

  it('counts the text with the suggestion in its place, not the suggestion alone', async () => {
    const service = await serviceOfFour();

    const { suggestions } = typedAtTheEnd(service, 'class:death applies:vul');

    expect(suggestions[0]).toMatchObject({ insert: 'applies:vulnerable', count: 2 });
  });

  it('does not count what is not a finished term (an operator, a bare field)', async () => {
    const service = await serviceOfFour();

    const { suggestions } = typedAtTheEnd(service, 'applies:vulnerable ');

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((suggestion) => suggestion.count === undefined)).toBe(true);
  });

  it('counts the first suggestion and leaves the others for after the list is drawn (the first is the one read out as the person types)', async () => {
    const service = await serviceOfFour();

    const { suggestions } = typedAtTheEnd(service, 'wea');

    const finished = suggestions.filter(({ complete }) => complete);
    expect(finished.length).toBeGreaterThan(1);
    expect(suggestions[0]?.count).toBeTypeOf('number');
    expect(suggestions.slice(1).every(({ count }) => count === undefined)).toBe(true);
  });

  it('runs one search for a keystroke, however many suggestions the list has', async () => {
    const service = await serviceOfFour();
    const countMatches = vi.spyOn(service, 'countMatches');

    typedAtTheEnd(service, 'wea');

    expect(countMatches).toHaveBeenCalledTimes(1);
  });

  it('suggests at the caret, wherever it is in the text', async () => {
    const service = await serviceOfFour();

    const { suggestions } = analyseQuery(service, initialExploreState, 'applies:vul OR weak', 11);

    expect(suggestions[0]).toMatchObject({ insert: 'applies:vulnerable', replace: [0, 11] });
  });

  it('judges every term as it stands, and suggests nothing, when there is no caret', async () => {
    const service = await serviceOfFour();
    const countMatches = vi.spyOn(service, 'countMatches');

    const analysis = analyseQuery(service, initialExploreState, 'zzzzzz', undefined);

    expect(analysis.suggestions).toEqual([]);
    // Not being typed, the word no trait has is a finished term: a warning.
    expect(analysis.issues.map(({ code }) => code)).toEqual(['text-in-no-trait']);
    expect(countMatches).toHaveBeenCalledTimes(1);
  });

  it('leaves the term being typed alone, as the lint does (D20)', async () => {
    const service = await serviceOfFour();

    expect(typedAtTheEnd(service, 'zzzzzz').issues).toEqual([]);
    expect(typedAtTheEnd(service, 'zzzzzz ').issues.map(({ code }) => code)).toEqual(['text-in-no-trait']);
  });

  it('asks the dataset once about a term that stays as it is: a service has one lint context', async () => {
    const service = await serviceOfFour();
    const countMatches = vi.spyOn(service, 'countMatches');

    typedAtTheEnd(service, 'zzzzzz ');
    typedAtTheEnd(service, 'zzzzzz ');

    expect(countMatches).toHaveBeenCalledTimes(1);
  });

  it('does not share what one dataset taught it with another', async () => {
    const first = await serviceOfFour();
    const second = await serviceOfFour();
    const countMatches = vi.spyOn(second, 'countMatches');

    typedAtTheEnd(first, 'zzzzzz ');
    typedAtTheEnd(second, 'zzzzzz ');

    expect(countMatches).toHaveBeenCalledTimes(1);
  });

  it('never throws, whatever the text and the caret', async () => {
    const service = await serviceOfFour();

    for (const [text, caret] of [
      ['', 0],
      ['"', 1],
      ['))((', 2],
      ['applies:', 8],
      ['a'.repeat(5_000), 5_000],
      ['weak', 99],
      ['weak', -3],
    ] as const) {
      expect(() => analyseQuery(service, initialExploreState, text, caret)).not.toThrow();
    }
  });
});

describe('countNext', () => {
  /** What the list holds, without the counts: a count may be added to a suggestion and nothing else about it changes. */
  const withoutCount = ({ kind, insert, detail, complete, replace }: CountedSuggestion) => ({
    kind,
    insert,
    detail,
    complete,
    replace,
  });
  const uncounted = (suggestions: readonly CountedSuggestion[]) =>
    suggestions.filter(({ complete, count }) => complete && count === undefined);

  it('counts the next suggestions of the list, a step at a time, until none is left', async () => {
    const service = await serviceOfFour();
    let suggestions = typedAtTheEnd(service, 'wea').suggestions;
    const toCount = uncounted(suggestions).length;
    expect(toCount).toBeGreaterThan(1);

    const left: number[] = [];
    for (;;) {
      const next = countNext(service, initialExploreState, 'wea', suggestions, 1);
      if (next === suggestions) break;
      suggestions = next;
      left.push(uncounted(suggestions).length);
    }

    expect(left).toEqual(Array.from({ length: toCount }, (_, step) => toCount - 1 - step));
    expect(suggestions.filter(({ complete }) => complete).every(({ count }) => typeof count === 'number')).toBe(true);
  });

  it('takes a few suggestions in a step unless it is told otherwise', async () => {
    const service = await serviceOfFour();
    const { suggestions } = typedAtTheEnd(service, 'wea');
    const countMatches = vi.spyOn(service, 'countMatches');

    countNext(service, initialExploreState, 'wea', suggestions);

    expect(countMatches).toHaveBeenCalledTimes(Math.min(COUNTS_PER_STEP, uncounted(suggestions).length));
  });

  it('counts within the filters of the page', async () => {
    const service = await serviceOfFour();
    const lifeOnly: ExploreState = { ...initialExploreState, classes: ['Life'] };
    const counts = (filters: ExploreState) =>
      countNext(service, filters, 'wea', typedAtTheEnd(service, 'wea', filters).suggestions, 99)
        .filter(({ complete }) => complete)
        .map(({ insert, count }) => [insert, count]);

    expect(counts(initialExploreState)).toContainEqual(['applies:weak', 1]);
    expect(counts(lifeOnly)).toContainEqual(['applies:weak', 0]);
  });

  it('counts no more than the limit it is given, and not a suggestion that has its count', async () => {
    const service = await serviceOfFour();
    const { suggestions } = typedAtTheEnd(service, 'wea');
    const countMatches = vi.spyOn(service, 'countMatches');

    const next = countNext(service, initialExploreState, 'wea', suggestions, 2);

    expect(countMatches).toHaveBeenCalledTimes(2);
    expect(next[0]).toBe(suggestions[0]);
    expect(uncounted(next)).toHaveLength(uncounted(suggestions).length - 2);
  });

  it('keeps the order of the list and every part of a suggestion but its count', async () => {
    const service = await serviceOfFour();
    const { suggestions } = typedAtTheEnd(service, 'wea');

    const next = countNext(service, initialExploreState, 'wea', suggestions);

    expect(next.map(withoutCount)).toEqual(suggestions.map(withoutCount));
  });

  it('gives the list back, the very same, when nothing is left to count: that is how the caller knows it is done', async () => {
    const service = await serviceOfFour();
    const all = countNext(service, initialExploreState, 'wea', typedAtTheEnd(service, 'wea').suggestions, 99);
    const countMatches = vi.spyOn(service, 'countMatches');

    expect(countNext(service, initialExploreState, 'wea', all)).toBe(all);
    expect(countMatches).not.toHaveBeenCalled();
  });

  it('has nothing to count where the list is empty or holds no finished term', async () => {
    const service = await serviceOfFour();
    const { suggestions: operators } = typedAtTheEnd(service, 'applies:vulnerable ');

    expect(countNext(service, initialExploreState, '', [])).toEqual([]);
    expect(countNext(service, initialExploreState, 'applies:vulnerable ', operators)).toBe(operators);
  });
});

describe('hasUncounted', () => {
  it('is true while a finished term of the list has no count, and false once every one has', async () => {
    const service = await serviceOfFour();
    const { suggestions } = typedAtTheEnd(service, 'wea');

    expect(hasUncounted(suggestions)).toBe(true);
    expect(hasUncounted(countNext(service, initialExploreState, 'wea', suggestions, 99))).toBe(false);
  });

  it('is false for a list that holds nothing to count: no suggestion, or no finished term', async () => {
    const service = await serviceOfFour();

    expect(hasUncounted([])).toBe(false);
    expect(hasUncounted(typedAtTheEnd(service, 'applies:vulnerable ').suggestions)).toBe(false);
  });
});

describe('optionsOf', () => {
  it('makes a row of the list of each suggestion, in the same order', async () => {
    const service = await serviceOfFour();
    const { suggestions } = typedAtTheEnd(service, 'applies:vul');

    const options = optionsOf(suggestions);

    expect(options.map(({ label }) => label)).toEqual(['applies:vulnerable']);
    expect(options[0]).toMatchObject({ badge: 'Debuff', trailing: '3', trailingUnit: 'traits', continues: false });
  });
});
