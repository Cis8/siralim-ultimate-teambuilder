/** How many recent searches are kept: the newest ones. */
export const MAX_RECENT = 10;

/** How many searches can be saved. A new one is refused past this, never swapped for an old one the person chose to keep. */
export const MAX_SAVED = 50;

/**
 * A search of this length is a pasted text, not a search (the lint stops at the same size): it is neither remembered nor
 * saved, and it bounds the size of a file of searches.
 */
export const MAX_SEARCH_LENGTH = 2000;

/** A search the person kept. The name is the query until a search can be renamed. */
export interface SavedSearch {
  readonly name: string;
  readonly query: string;
}

/**
 * The searches a person comes back to: `recent` has the newest first, `saved` the first one saved first. A search is
 * trimmed, never blank and listed once in each list; two searches are the same when their text is exactly the same.
 */
export interface SearchHistory {
  readonly recent: readonly string[];
  readonly saved: readonly SavedSearch[];
}

export const emptySearchHistory: SearchHistory = { recent: [], saved: [] };

/** Why a search was not saved. */
export type SaveRefusal = 'empty' | 'too-long' | 'full';

/** The history with the search saved or taken off, or why it could not be saved. */
export type ToggleSavedResult =
  { readonly ok: true; readonly history: SearchHistory } | { readonly ok: false; readonly reason: SaveRefusal };

/**
 * Remembers a search as the newest. A search already there moves to the front; one that is blank or a pasted text is not
 * remembered. A search that changes nothing gives the very same history back.
 */
export function recordRecent(history: SearchHistory, query: string): SearchHistory {
  const search = query.trim();
  if (search === '' || search.length > MAX_SEARCH_LENGTH || history.recent[0] === search) return history;
  const others = history.recent.filter((recent) => recent !== search);
  return { ...history, recent: [search, ...others].slice(0, MAX_RECENT) };
}

export function isSaved(history: SearchHistory, query: string): boolean {
  const search = query.trim();
  return history.saved.some((saved) => saved.query === search);
}

/**
 * Saves a search, or takes it off when it is saved already (the star of the field). A saved search can always be taken
 * off; a new one is refused when it is blank, a pasted text or the fifty places are taken.
 */
export function toggleSaved(history: SearchHistory, query: string): ToggleSavedResult {
  const search = query.trim();
  if (isSaved(history, search)) return { ok: true, history: removeSaved(history, search) };
  if (search === '') return { ok: false, reason: 'empty' };
  if (search.length > MAX_SEARCH_LENGTH) return { ok: false, reason: 'too-long' };
  if (history.saved.length >= MAX_SAVED) return { ok: false, reason: 'full' };
  return { ok: true, history: { ...history, saved: [...history.saved, { name: search, query: search }] } };
}

/** Forgets a recent search; the very same history when it is not there. A saved search of the same text stays. */
export function removeRecent(history: SearchHistory, query: string): SearchHistory {
  const search = query.trim();
  if (!history.recent.includes(search)) return history;
  return { ...history, recent: history.recent.filter((recent) => recent !== search) };
}

/** Takes a search off the saved list; the very same history when it is not there. A recent search of the same text stays. */
export function removeSaved(history: SearchHistory, query: string): SearchHistory {
  const search = query.trim();
  if (!isSaved(history, search)) return history;
  return { ...history, saved: history.saved.filter((saved) => saved.query !== search) };
}
