import { MAX_SUGGESTIONS, type SavedSearch, type SearchHistory } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import { historyOptions, historyRows, MAX_RECENT_ROWS } from './history-options';

const saved = (query: string, name = query): SavedSearch => ({ name, query });
const searches = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, at) => `${prefix} ${String(at)}`);

describe('historyRows', () => {
  it('lists nothing for an empty history', () => {
    expect(historyRows({ recent: [], saved: [] })).toEqual([]);
  });

  it('lists the recent searches first, newest first, then the saved ones in the order they were saved', () => {
    const history: SearchHistory = { recent: ['c', 'b'], saved: [saved('x'), saved('y')] };

    expect(historyRows(history)).toEqual([
      { source: 'recent', query: 'c', name: 'c' },
      { source: 'recent', query: 'b', name: 'b' },
      { source: 'saved', query: 'x', name: 'x' },
      { source: 'saved', query: 'y', name: 'y' },
    ]);
  });

  it('carries the name a saved search was given', () => {
    const [row] = historyRows({ recent: [], saved: [saved('uses:weak', 'Weak payoffs')] });

    expect(row).toEqual({ source: 'saved', query: 'uses:weak', name: 'Weak payoffs' });
  });

  it('lists a search that is saved once, as saved: the star already says it was kept', () => {
    const history: SearchHistory = { recent: ['kept', 'fleeting'], saved: [saved('kept')] };

    expect(historyRows(history).map(({ source, query }) => `${source}:${query}`)).toEqual([
      'recent:fleeting',
      'saved:kept',
    ]);
  });

  it('keeps the list within what the suggestions may be, so that it never scrolls', () => {
    const history: SearchHistory = { recent: searches('r', 10), saved: searches('s', 50).map((query) => saved(query)) };

    expect(historyRows(history)).toHaveLength(MAX_SUGGESTIONS);
  });

  it('shows five recent searches at most, and gives the rest of the room to the saved ones', () => {
    const history: SearchHistory = { recent: searches('r', 10), saved: searches('s', 50).map((query) => saved(query)) };

    const rows = historyRows(history);

    expect(rows.filter(({ source }) => source === 'recent')).toHaveLength(MAX_RECENT_ROWS);
    expect(rows.filter(({ source }) => source === 'saved')).toHaveLength(MAX_SUGGESTIONS - MAX_RECENT_ROWS);
    expect(rows.map(({ query }) => query).slice(0, MAX_RECENT_ROWS)).toEqual(searches('r', 5));
  });

  it('gives the recent searches the room that few saved ones leave', () => {
    const history: SearchHistory = { recent: searches('r', 10), saved: [saved('only')] };

    const rows = historyRows(history);

    expect(rows.map(({ source }) => source)).toEqual([
      ...Array.from({ length: MAX_SUGGESTIONS - 1 }, () => 'recent'),
      'saved',
    ]);
  });

  it('fills the room with the saved searches when there are few recent ones', () => {
    const history: SearchHistory = { recent: ['r'], saved: searches('s', 20).map((query) => saved(query)) };

    const rows = historyRows(history);

    expect(rows).toHaveLength(MAX_SUGGESTIONS);
    expect(rows.filter(({ source }) => source === 'saved')).toHaveLength(MAX_SUGGESTIONS - 1);
  });

  it('counts the room by the recent searches that are shown, not by those a saved search hides', () => {
    const history: SearchHistory = {
      recent: ['kept 0', 'kept 1', 'kept 2', 'kept 3', 'kept 4', 'a', 'b', 'c', 'd', 'e'],
      saved: ['kept 0', 'kept 1', 'kept 2', 'kept 3', 'kept 4'].map((query) => saved(query)),
    };

    const rows = historyRows(history);

    expect(rows.filter(({ source }) => source === 'recent').map(({ query }) => query)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(rows.filter(({ source }) => source === 'saved')).toHaveLength(MAX_SUGGESTIONS - MAX_RECENT_ROWS);
  });
});

describe('historyOptions', () => {
  it('names each row for what it is in a word, and writes the search in the font of the field', () => {
    const options = historyOptions([
      { source: 'recent', query: 'weak', name: 'weak' },
      { source: 'saved', query: 'uses:weak', name: 'uses:weak' },
    ]);

    expect(options.map(({ badge, label }) => [badge, label])).toEqual([
      ['Recent', 'weak'],
      ['Saved', 'uses:weak'],
    ]);
  });

  it('says the name of a saved search beside it only when the name is not the search', () => {
    const options = historyOptions([
      { source: 'saved', query: 'uses:weak', name: 'Weak payoffs' },
      { source: 'saved', query: 'uses:snared', name: 'uses:snared' },
    ]);

    expect(options.map(({ detail }) => detail)).toEqual(['Weak payoffs', '']);
  });

  it('finishes the search: taking one leaves nothing to continue, and it has no count', () => {
    const [option] = historyOptions([{ source: 'recent', query: 'weak', name: 'weak' }]);

    expect(option).toMatchObject({ continues: false, tone: 'neutral' });
    expect(option).not.toHaveProperty('trailing');
  });
});
