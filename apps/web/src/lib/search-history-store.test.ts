import { emptySearchHistory, type SearchHistory } from '@atlas/core';
import { describe, expect, it } from 'vitest';
import type { StorageLike } from './last-party-store';
import { createSearchHistoryStore, SEARCH_HISTORY_KEY } from './search-history-store';

/** A storage that remembers in a map, and can be made to fail the way a blocked one does. */
function fakeStorage(fail: 'never' | 'always' = 'never') {
  const items = new Map<string, string>();
  const refuse = (): never => {
    throw new Error('storage is blocked');
  };
  const storage: StorageLike = {
    getItem: (key) => (fail === 'always' ? refuse() : (items.get(key) ?? null)),
    setItem: (key, value) => {
      if (fail === 'always') refuse();
      items.set(key, value);
    },
    removeItem: (key) => {
      if (fail === 'always') refuse();
      items.delete(key);
    },
  };
  return { storage, items };
}

const history: SearchHistory = {
  recent: ['applies:snared', 'weak OR vulnerable'],
  saved: [
    { name: 'uses:vulnerable mat:yes', query: 'uses:vulnerable mat:yes' },
    { name: 'start of battle', query: '"start of battle" kw:barrier' },
  ],
};

describe('createSearchHistoryStore', () => {
  it('loads an empty history before anything was saved', () => {
    const { storage } = fakeStorage();

    expect(createSearchHistoryStore(() => storage).load()).toEqual(emptySearchHistory);
  });

  it('loads the history that was saved, names included', () => {
    const { storage } = fakeStorage();
    const store = createSearchHistoryStore(() => storage);

    store.save(history);

    expect(store.load()).toEqual(history);
  });

  it('keeps it for the next visit: a store made later over the same storage loads it', () => {
    const { storage } = fakeStorage();
    createSearchHistoryStore(() => storage).save(history);

    expect(createSearchHistoryStore(() => storage).load()).toEqual(history);
  });

  it('keeps the text of the file that Export writes, under one key', () => {
    const { storage, items } = fakeStorage();

    createSearchHistoryStore(() => storage).save(history);

    expect([...items.keys()]).toEqual([SEARCH_HISTORY_KEY]);
    expect(JSON.parse(items.get(SEARCH_HISTORY_KEY) ?? '')).toMatchObject({
      app: 'trait-atlas',
      kind: 'search-history',
      version: 1,
      recent: history.recent,
    });
  });

  it('replaces what was saved before', () => {
    const { storage } = fakeStorage();
    const store = createSearchHistoryStore(() => storage);
    store.save(history);

    store.save({ recent: ['weak'], saved: [] });

    expect(store.load()).toEqual({ recent: ['weak'], saved: [] });
  });

  it('forgets everything when the history is empty: emptying it is the last thing the player did', () => {
    const { storage, items } = fakeStorage();
    const store = createSearchHistoryStore(() => storage);
    store.save(history);

    store.save(emptySearchHistory);

    expect(items.size).toBe(0);
    expect(store.load()).toEqual(emptySearchHistory);
  });

  describe('a value that is not a history of this app (damaged, written by hand, from another version)', () => {
    it.each([
      ['text that is not JSON', '{"app": "trait-atlas", "kind": "search-his'],
      [
        'JSON of another app',
        JSON.stringify({ app: 'other', kind: 'search-history', version: 1, recent: [], saved: [] }),
      ],
      [
        'a file of another version',
        JSON.stringify({ app: 'trait-atlas', kind: 'search-history', version: 2, recent: [], saved: [] }),
      ],
      [
        'lists that are not lists of searches',
        JSON.stringify({ app: 'trait-atlas', kind: 'search-history', version: 1, recent: [1], saved: [] }),
      ],
      ['no value at all', ''],
    ])('loads an empty history from %s, as it would refuse the file', (_, stored) => {
      const { storage, items } = fakeStorage();
      items.set(SEARCH_HISTORY_KEY, stored);

      expect(createSearchHistoryStore(() => storage).load()).toEqual(emptySearchHistory);
    });

    it('is replaced by the next save', () => {
      const { storage, items } = fakeStorage();
      items.set(SEARCH_HISTORY_KEY, 'damaged');
      const store = createSearchHistoryStore(() => storage);

      store.save(history);

      expect(store.load()).toEqual(history);
    });
  });

  describe('when the storage cannot be used (a private window, blocked site data)', () => {
    it('loads nothing, which is not an empty history: the page keeps what it holds', () => {
      const { storage } = fakeStorage('always');

      expect(createSearchHistoryStore(() => storage).load()).toBeUndefined();
    });

    it('saves nothing and does not throw', () => {
      const { storage } = fakeStorage('always');
      const store = createSearchHistoryStore(() => storage);

      expect(() => {
        store.save(history);
        store.save(emptySearchHistory);
      }).not.toThrow();
    });

    it('copes with there being no storage, or one that throws when it is asked for', () => {
      const none = createSearchHistoryStore(() => undefined);
      const throwing = createSearchHistoryStore(() => {
        throw new Error('SecurityError');
      });

      for (const store of [none, throwing]) {
        expect(store.load()).toBeUndefined();
        expect(() => {
          store.save(history);
        }).not.toThrow();
      }
    });
  });
});
