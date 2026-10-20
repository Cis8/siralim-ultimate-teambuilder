import {
  emptySearchHistory,
  exportHistory,
  importHistory,
  isSaved,
  recordRecent,
  removeRecent,
  removeSaved,
  toggleSaved,
  type ImportResult,
  type SearchHistory,
  type ToggleSavedResult,
} from '@atlas/core';
import { createSubscriber } from 'svelte/reactivity';
import type { SearchHistoryStore } from './search-history-store';

export interface SearchHistorySessionDependencies {
  /** Where the searches are kept for the next visit (ADR-0005). */
  readonly store: SearchHistoryStore;
}

/**
 * The recent and saved searches, shared by whatever of the page shows or changes them (SPEC §8.3). It lives for as long as the app
 * does and keeps the history in the browser after every change. The rules are those of `core/history`; this is only where the
 * history is held and kept.
 *
 * `history` is reactive: an effect that reads it runs again when it changes.
 */
export interface SearchHistorySession {
  readonly history: SearchHistory;
  /** Reads what the browser kept. Call it once the page runs: the prerendered page has no storage to read. */
  load(): void;
  /** Remembers a search as the newest recent one (a blank one is not remembered). */
  record(query: string): void;
  /** Saves a search, or takes it off when it is saved; a search that is saved is also remembered as a recent one. */
  toggleSaved(query: string): ToggleSavedResult;
  removeRecent(query: string): void;
  removeSaved(query: string): void;
  /** Adds the searches of a file (the text of what `exportFile` gave once) to the history, or says why it did not. */
  importFile(text: string): ImportResult;
  /** The history as the text of a file to keep. */
  exportFile(): string;
  /** `listener` is called after every change; the result stops it. */
  subscribe(listener: () => void): () => void;
}

const sameSearches = <Item>(a: readonly Item[], b: readonly Item[], same: (a: Item, b: Item) => boolean): boolean =>
  a.length === b.length && a.every((item, at) => same(item, b[at] as Item));

const sameHistory = (a: SearchHistory, b: SearchHistory): boolean =>
  a === b ||
  (sameSearches(a.recent, b.recent, (x, y) => x === y) &&
    sameSearches(a.saved, b.saved, (x, y) => x.query === y.query && x.name === y.name));

export function createSearchHistorySession({ store }: SearchHistorySessionDependencies): SearchHistorySession {
  let history = emptySearchHistory;

  const watchers = new Set<() => void>();
  // A field read in an effect starts watching, and the effect runs again when `changed` calls its `update`.
  const observe = createSubscriber((update) => {
    watchers.add(update);
    return () => {
      watchers.delete(update);
    };
  });

  /** What the page holds is now `next`: told to the watchers when it is not what they saw. */
  function hold(next: SearchHistory): void {
    if (sameHistory(history, next)) return;
    history = next;
    for (const watcher of watchers) watcher();
  }

  /**
   * What a change is made to: what the browser keeps, which another page of the app may have changed since this one looked, and
   * only when the browser keeps nothing (it cannot be read) what this page holds.
   */
  const current = (): SearchHistory => store.load() ?? history;

  /** Makes a change to the freshest history and keeps the result, if it is another. */
  function change(edit: (base: SearchHistory) => SearchHistory): void {
    const base = current();
    const next = edit(base);
    if (next !== base) store.save(next);
    hold(next);
  }

  return {
    get history() {
      observe();
      return history;
    },
    load() {
      const kept = store.load();
      if (kept !== undefined) hold(kept);
    },
    record(query) {
      change((base) => recordRecent(base, query));
    },
    toggleSaved(query) {
      const base = current();
      const result = toggleSaved(base, query);
      if (!result.ok) {
        hold(base);
        return result;
      }
      const next = isSaved(base, query) ? result.history : recordRecent(result.history, query);
      if (next !== base) store.save(next);
      hold(next);
      return { ok: true, history: next };
    },
    removeRecent(query) {
      change((base) => removeRecent(base, query));
    },
    removeSaved(query) {
      change((base) => removeSaved(base, query));
    },
    importFile(text) {
      const base = current();
      const result = importHistory(text, base);
      if (!result.ok) return result;
      if (result.history !== base) store.save(result.history);
      hold(result.history);
      return result;
    },
    exportFile() {
      return exportHistory(current());
    },
    subscribe(listener) {
      watchers.add(listener);
      return () => {
        watchers.delete(listener);
      };
    },
  };
}
