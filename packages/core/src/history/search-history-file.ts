import { MAX_RECENT, MAX_SAVED, MAX_SEARCH_LENGTH, type SavedSearch, type SearchHistory } from './search-history';

const FILE_APP = 'trait-atlas';
const FILE_KIND = 'search-history';
const FILE_VERSION = 1;
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/**
 * The most text a file of searches may have, read as text before it is parsed. The biggest file this app writes (fifty
 * saved searches and ten recent ones, each at the length limit, every character a control character that JSON writes as
 * six) is about 1.3 million; the test of the file holds the two together.
 */
export const MAX_FILE_LENGTH = 2_000_000;

/** Why a file was not taken. Nothing is changed by a refusal. */
export type ImportRefusal =
  /** The text is not JSON: a file cut short, a page, nothing. */
  | 'not-json'
  /** JSON, but not a file of search history made by this app. */
  | 'foreign'
  /** Made by a version of this app that writes the file differently. */
  | 'wrong-version'
  /** Right app, right version, but a list is not a list of searches. */
  | 'malformed'
  /** More than the app ever keeps: too many searches, a search that is a pasted text, a text too big to read. */
  | 'too-large';

/** How many searches of each list. */
export interface ImportCounts {
  readonly recent: number;
  readonly saved: number;
}

export type ImportResult =
  | {
      readonly ok: true;
      readonly history: SearchHistory;
      /** The searches the file added. */
      readonly added: ImportCounts;
      /** The new searches of the file that did not fit, a list being full. A search that was there already is no such case. */
      readonly leftOut: ImportCounts;
    }
  | { readonly ok: false; readonly reason: ImportRefusal };

/** The text of a file with the history in it, for a person to keep and for `importHistory` to read. */
export function exportHistory(history: SearchHistory): string {
  return JSON.stringify(
    {
      app: FILE_APP,
      kind: FILE_KIND,
      version: FILE_VERSION,
      recent: history.recent,
      saved: history.saved.map(({ name, query }) => ({ name, query })),
    },
    null,
    2,
  );
}

/**
 * Adds the searches of a file to the history, never throwing: a text that is not a file of this app, in this version, within
 * the limits, is refused whole and changes nothing. What is there stays first and in its place; the file adds the searches
 * the history does not have, by their text (a search that is there keeps its name), as far as the lists have room, so
 * reading a file a second time adds nothing. A file is read leniently: blanks around a search, a blank search, a search
 * listed twice and properties it does not know are of no matter.
 */
export function importHistory(text: string, current: SearchHistory): ImportResult {
  const read = readHistoryFile(text);
  if (!read.ok) return read;

  const recent = merged(current.recent, read.value.recent, (search) => search, MAX_RECENT);
  const saved = merged(current.saved, read.value.saved, (search) => search.query, MAX_SAVED);
  const changed = recent.added > 0 || saved.added > 0;
  return {
    ok: true,
    history: changed ? { recent: recent.list, saved: saved.list } : current,
    added: { recent: recent.added, saved: saved.added },
    leftOut: { recent: recent.leftOut, saved: saved.leftOut },
  };
}

type Outcome<Value> =
  { readonly ok: true; readonly value: Value } | { readonly ok: false; readonly reason: ImportRefusal };

function refused(reason: ImportRefusal): { readonly ok: false; readonly reason: ImportRefusal } {
  return { ok: false, reason };
}

/** An object to read properties of. An array passes, and has none of the ones asked for. */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** The searches a file holds, in the order of the file, trimmed and once each. */
function readHistoryFile(text: string): Outcome<SearchHistory> {
  if (text.length > MAX_FILE_LENGTH) return refused('too-large');

  let file: unknown;
  try {
    // Some editors on Windows put a byte order mark in front of the text; JSON does not allow one.
    file = JSON.parse(text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text);
  } catch {
    return refused('not-json');
  }
  if (!isRecord(file) || file['app'] !== FILE_APP || file['kind'] !== FILE_KIND) return refused('foreign');
  if (file['version'] !== FILE_VERSION) return refused('wrong-version');

  const recent = file['recent'];
  const saved = file['saved'];
  if (!isList(recent) || !isList(saved)) return refused('malformed');
  if (recent.length > MAX_RECENT || saved.length > MAX_SAVED) return refused('too-large');

  const recentSearches = readEach(recent, readSearch);
  if (!recentSearches.ok) return recentSearches;
  const savedSearches = readEach(saved, readSavedSearch);
  if (!savedSearches.ok) return savedSearches;
  return {
    ok: true,
    value: {
      recent: distinct(recentSearches.value, (search) => search),
      saved: distinct(savedSearches.value, (search) => search.query),
    },
  };
}

function readEach<Item>(list: readonly unknown[], readEntry: (entry: unknown) => Outcome<Item>): Outcome<Item[]> {
  const items: Item[] = [];
  for (const entry of list) {
    const read = readEntry(entry);
    if (!read.ok) return read;
    items.push(read.value);
  }
  return { ok: true, value: items };
}

/** A text of a search, trimmed. It may be blank: `distinct` drops those. */
function readSearch(entry: unknown): Outcome<string> {
  if (typeof entry !== 'string') return refused('malformed');
  const search = entry.trim();
  return search.length > MAX_SEARCH_LENGTH ? refused('too-large') : { ok: true, value: search };
}

function readSavedSearch(entry: unknown): Outcome<SavedSearch> {
  if (!isRecord(entry)) return refused('malformed');
  const query = readSearch(entry['query']);
  if (!query.ok) return query;
  const name = readSearch(entry['name']);
  if (!name.ok) return name;
  return { ok: true, value: { name: name.value === '' ? query.value : name.value, query: query.value } };
}

/** The items with a search, the first of those that have the same one. */
function distinct<Item>(items: readonly Item[], searchOf: (item: Item) => string): Item[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const search = searchOf(item);
    if (search === '' || seen.has(search)) return false;
    seen.add(search);
    return true;
  });
}

/** `kept` followed by the `incoming` items it has no search of, as far as `limit` allows. */
function merged<Item>(
  kept: readonly Item[],
  incoming: readonly Item[],
  searchOf: (item: Item) => string,
  limit: number,
): { readonly list: readonly Item[]; readonly added: number; readonly leftOut: number } {
  const known = new Set(kept.map(searchOf));
  const fresh = incoming.filter((item) => !known.has(searchOf(item)));
  const room = Math.max(0, limit - kept.length);
  return {
    list: [...kept, ...fresh.slice(0, room)],
    added: Math.min(room, fresh.length),
    leftOut: Math.max(0, fresh.length - room),
  };
}
