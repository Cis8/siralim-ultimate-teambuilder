import { describe, expect, it } from 'vitest';
import { fieldRegistry } from '../query/fields';
import type { QueryVocabulary } from '../query/query-vocabulary';
import { taxonomy } from '../taxonomy/taxonomy';
import type { Suggestion } from './suggestion';
import { suggestQuery } from './suggest-query';
import type { SuggestionEnvironment } from './suggestion-registry';
import { withCounts } from './with-counts';

const vocabulary: QueryVocabulary = {
  class: ['Chaos', 'Death', 'Life', 'Nature', 'Sorcery'],
  family: ['Clutcher', 'Dire Wolf', 'Rodian Master'],
  creature: ['Clutcher Bruiser', 'Dire Wolf', 'Mindweaver'],
  name: ['Aegis of Life', "Mother's Love", 'Weakness Exploit', 'Wolf Pack'],
};
const environment: SuggestionEnvironment = { fields: fieldRegistry, taxonomy, vocabulary };

const suggestionsFor = (source: string): readonly Suggestion[] => suggestQuery(source, source.length, environment);

/** A count that remembers what it was asked, and answers with the length of the text: a different number for each. */
function recordingCount() {
  const asked: string[] = [];
  return {
    asked,
    count: (query: string): number => {
      asked.push(query);
      return query.length;
    },
  };
}

describe('withCounts', () => {
  it('counts a finished term as the query the bar would hold once it is accepted (D18)', () => {
    const { asked, count } = recordingCount();

    const counted = withCounts('weak OR class:li', suggestionsFor('weak OR class:li'), count);

    expect(counted).toHaveLength(1);
    expect(counted[0]).toMatchObject({ insert: 'class:Life', complete: true });
    expect(asked).toEqual(['weak OR class:Life ']);
    expect(counted[0]?.count).toBe('weak OR class:Life '.length);
  });

  it('counts each of the terms that a word may become, with the rest of the query round it', () => {
    const { asked, count } = recordingCount();

    const counted = withCounts('-snared wea', suggestionsFor('-snared wea'), count);

    expect(counted.map(({ insert }) => insert)).toEqual([
      'applies:weak',
      'uses:weak',
      'trait:"Weakness Exploit"',
      'wea',
    ]);
    expect(asked).toEqual([
      '-snared applies:weak ',
      '-snared uses:weak ',
      '-snared trait:"Weakness Exploit" ',
      '-snared wea ',
    ]);
    expect(counted.map((each) => each.count)).toEqual(asked.map((query) => query.length));
  });

  it('counts the query as it is written in the bar, so a term in the middle of the text is counted among the rest', () => {
    const { asked, count } = recordingCount();
    const source = 'weak class:li OR snared';

    withCounts(source, suggestQuery(source, 'weak class:li'.length, environment), count);

    expect(asked).toEqual(['weak class:Life OR snared']);
  });

  it('does not count what is not a finished term: an operator and a bare field are not searched for', () => {
    const { asked, count } = recordingCount();
    const offered = suggestionsFor('weak ');

    const counted = withCounts('weak ', offered, count);

    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every(({ complete }) => !complete)).toBe(true);
    expect(asked).toEqual([]);
    for (const each of counted) expect(each).not.toHaveProperty('count');
  });

  it('counts the fix of a field only when a value follows it', () => {
    const { asked, count } = recordingCount();

    const withValue = withCounts('clas:life', suggestionsFor('clas:life'), count);
    const bare = withCounts('clas:', suggestionsFor('clas:'), count);

    expect(withValue[0]).toMatchObject({ insert: 'class:', count: 'class:life'.length });
    expect(bare[0]).not.toHaveProperty('count');
    expect(asked).toEqual(['class:life']);
  });

  it('keeps the order of the suggestions and everything else about each', () => {
    const offered = suggestionsFor('wea');

    const counted = withCounts('wea', offered, () => 3);

    expect(counted).toHaveLength(offered.length);
    counted.forEach((each, at) => {
      const { count, ...rest } = each;
      expect(rest).toEqual(offered[at]);
      expect(count).toBe(3);
    });
  });

  it('keeps a count of nothing: a suggestion that finds no trait is shown as such', () => {
    const [first] = withCounts('wea', suggestionsFor('wea'), () => 0);

    expect(first).toHaveProperty('count', 0);
  });

  it('gives an empty list for an empty list, without asking', () => {
    const { asked, count } = recordingCount();

    expect(withCounts('', [], count)).toEqual([]);
    expect(asked).toEqual([]);
  });

  it('does not change the suggestions it was given', () => {
    const offered = suggestionsFor('wea');

    withCounts('wea', offered, () => 1);

    expect(offered).toEqual(suggestionsFor('wea'));
    for (const each of offered) expect(each).not.toHaveProperty('count');
  });
});
