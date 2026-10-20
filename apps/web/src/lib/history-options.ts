import { MAX_SUGGESTIONS, type SearchHistory } from '@atlas/core';
import type { ComboboxOption } from './combobox-option';
import { copy } from './copy';

/** How many recent searches the list of an empty field holds before the saved ones take the room: they are what a person chose to keep. */
export const MAX_RECENT_ROWS = 5;

/** One search the list of an empty field offers: where it comes from, what it says, and the name it was saved under. */
export interface HistoryRow {
  readonly source: 'recent' | 'saved';
  readonly query: string;
  readonly name: string;
}

/**
 * What an empty field lists (SPEC §8.3): the recent searches, newest first, then the saved ones in the order they were saved, as
 * many as the list of suggestions holds, so that it never scrolls. A search that is saved is listed once, as saved. Five recent
 * searches at most make way for the saved ones, and the room that one of them leaves is the other's.
 */
export function historyRows({ recent, saved }: SearchHistory): readonly HistoryRow[] {
  const savedQueries = new Set(saved.map(({ query }) => query));
  const unsaved = recent.filter((query) => !savedQueries.has(query));
  const savedShown = Math.min(saved.length, MAX_SUGGESTIONS - Math.min(unsaved.length, MAX_RECENT_ROWS));
  const recentShown = Math.min(unsaved.length, MAX_SUGGESTIONS - savedShown);
  return [
    ...unsaved.slice(0, recentShown).map((query): HistoryRow => ({ source: 'recent', query, name: query })),
    ...saved.slice(0, savedShown).map(({ query, name }): HistoryRow => ({ source: 'saved', query, name })),
  ];
}

/** The rows of the list that a history is: each is a whole search, so taking one finishes the term and there is no count to give. */
export function historyOptions(rows: readonly HistoryRow[]): readonly ComboboxOption[] {
  return rows.map(({ source, query, name }) => ({
    badge: copy.historyKinds[source],
    tone: 'neutral',
    label: query,
    detail: name === query ? '' : name,
    continues: false,
  }));
}
