import { emptySearchHistory, exportHistory, importHistory, type SearchHistory } from '@atlas/core';
import type { StorageLike } from './last-party-store';

export const SEARCH_HISTORY_KEY = 'trait-atlas:search-history';

/** The recent and saved searches, kept in the browser for the next visit (ADR-0005: a convenience, never the source of truth). */
export interface SearchHistoryStore {
  /**
   * What the browser keeps: an empty history when nothing is kept or what is kept is damaged (it is read as a file of searches
   * would be, and refused whole); `undefined` when the storage cannot be read, which says nothing about what is in it.
   */
  load(): SearchHistory | undefined;
  /** Keeps the history under the text of the file Export writes, and forgets it when it is empty. */
  save(history: SearchHistory): void;
}

/**
 * `storage` is asked for on every use: in a private window or with site data blocked it can be missing, or throw when it is asked
 * for or used, and then the store remembers nothing, which the page does not notice.
 */
export function createSearchHistoryStore(storage: () => StorageLike | undefined): SearchHistoryStore {
  function attempt<Result>(use: (storage: StorageLike) => Result): Result | undefined {
    try {
      const available = storage();
      return available === undefined ? undefined : use(available);
    } catch {
      return undefined;
    }
  }

  return {
    load() {
      // Not `undefined` itself: a storage that answers `null` is readable, and has nothing.
      const read = attempt((available) => ({ text: available.getItem(SEARCH_HISTORY_KEY) }));
      if (read === undefined) return undefined;
      if (read.text === null) return emptySearchHistory;
      const imported = importHistory(read.text, emptySearchHistory);
      return imported.ok ? imported.history : emptySearchHistory;
    },
    save(history) {
      const empty = history.recent.length === 0 && history.saved.length === 0;
      attempt((available) => {
        if (empty) available.removeItem(SEARCH_HISTORY_KEY);
        else available.setItem(SEARCH_HISTORY_KEY, exportHistory(history));
      });
    },
  };
}
